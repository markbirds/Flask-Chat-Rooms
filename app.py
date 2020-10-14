from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
import random
import string

app = Flask(__name__)

ENV = 'Development'

if ENV == 'Development':
    app.debug = True
    app.config['SQLALCHEMY_DATABASE_URI'] = "postgresql://postgres:postgres@localhost/ChatRoomDB"
else:  
    app.debug = False
    app.config['SQLALCHEMY_DATABASE_URI'] = ''

app.config['SECRET_KEY'] = 'secret!'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = 'FALSE'

socketio = SocketIO(app)
db = SQLAlchemy(app)

class Rooms(db.Model):
    room_id = db.Column(db.Integer, primary_key=True)
    room_name = db.Column(db.String(50))

    def __init__(self,room_name):
        self.room_name = room_name

    def __repr__(self):
        return f'Room: {self.room_name}'

class Messages(db.Model):
    message_id = db.Column(db.Integer, primary_key=True)
    message = db.Column(db.String(100))
    sender = db.Column(db.String(100))
    room_id = db.Column(db.Integer)

    def __init__(self,message,sender,room_id):
        self.message = message
        self.sender = sender
        self.room_id = room_id

    def __repr__(self):
        return f'Message: {self.message}'

# number of users in the server
number_of_users = 0

# when user logs in; send the total number of users in the server and the rooms in the database
@socketio.on('connect')
def user_connect():
    global number_of_users
    number_of_users+=1
    rooms_query = Rooms.query.all()
    rooms = []
    for room in rooms_query:
        rooms.append({'room_id': room.room_id, 'room_name': room.room_name})
    send({'total_users': number_of_users, 'rooms': rooms}, broadcast=True)

# user logs out/ close the page/ refresh the page; update the current number of users
@socketio.on('disconnect')
def user_disconnect():
    global number_of_users
    number_of_users-=1
    emit('disconnect',str(number_of_users), broadcast=True)

# user creates a room, save the room name in db; update the available rooms
@socketio.on('create')
def create_room(room_name):
    room = Rooms(room_name=room_name)
    db.session.add(room)
    db.session.commit()
    rooms_query = Rooms.query.all()
    rooms = []
    for room in rooms_query:
        rooms.append({'room_id': room.room_id, 'room_name': room.room_name})
    send({'total_users': number_of_users, 'rooms': rooms}, broadcast=True)

# user joins a room; load and send all the messages based on the room id
@socketio.on('join_room')
def on_join(data):
    username = data['username']
    room_id = data['room_id']
    room = Rooms.query.filter_by(room_id=room_id).first().room_name
    join_room(room)
    messages_query = Messages.query.filter_by(room_id=room_id)
    messages =[]
    for message in messages_query:
        messages.append({'sender': message.sender, 'message': message.message})
    emit('load_messages',{'room_name': room,'messages': messages})
    emit('joined',username + ' has entered the room.', room=room, broadcast=True)
    message = Messages(message=f'{username} has entered the room',sender=username,room_id=room_id)
    db.session.add(message)
    db.session.commit()

# user left the room; save the left message in db
@socketio.on('leave')
def on_leave(data):
    try:
        username = data['username']
        room_id = data['room_id']
        message = Messages(message=f'{username} has left the room',sender=username,room_id=room_id)
        db.session.add(message)
        db.session.commit()
        room = Rooms.query.filter_by(room_id=room_id).first()
        emit('leave',username + ' has left the room.', room=room.room_name, broadcast=True)
        leave_room(room.room_name)
    except:
        pass

# user deletes the room; delete all room messages first before removing the room name in db
@socketio.on('delete')
def delete_room(data):
    username = data['username']
    room_id = data['room_id']
    room = Rooms.query.filter_by(room_id=room_id).first()
    emit('delete',username + ' has deleted this room.', room=room.room_name, broadcast=True)
    Messages.query.filter_by(room_id=room_id).delete()
    db.session.commit()
    Rooms.query.filter_by(room_id=room_id).delete()
    db.session.commit()
    rooms_query = Rooms.query.all()
    rooms = []
    for room in rooms_query:
        rooms.append({'room_id': room.room_id, 'room_name': room.room_name})
    send({'total_users': number_of_users, 'rooms': rooms}, broadcast=True)
    
# all messages will be saved in db and will be broadcasted to all the users in the room
@socketio.on('chat')
def chat_message(data):
    message = data['message_body']
    sender = data['sender']
    room = data['room']
    room_id = data['room_id']
    current_user = data['current_user']
    message_object = Messages(message=message,sender=sender,room_id=room_id)
    db.session.add(message_object)
    db.session.commit()
    emit('chat',{'message':message, 'sender': sender, 'current_user':current_user}, room=room, broadcast=True)

# user login; the user will be given an 10 character id consisting of both words and digits
@app.route('/', methods=['GET','POST'])
def index():
    if request.method == 'POST':
        username = request.form['username']
        return redirect(url_for('rooms',user=username,user_id=''.join(random.choices(string.ascii_uppercase + string.digits, k=10))))
    return render_template('index.html')

# renders rooms.html with url example: /rooms/markbirds/ASDHF23NFA
@app.route('/rooms/<user>/<user_id>')
def rooms(user,user_id):
    return render_template('rooms.html',user=user,user_id=user_id)

if __name__ == '__main__':
    socketio.run(app)