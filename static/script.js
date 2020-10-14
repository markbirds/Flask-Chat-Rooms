var socket = io();
const messages_container = document.getElementById('chat_box');

$(document).ready(function(){

    // if user fails to connect, users will still be seeing please refresh the page message.
    socket.on('connect', function() {
        let output = 
        '<div class="text-center mt-2">'+
            '<p>No room selected.</p>'+
        '</div>';
        $('#chat_box').html(output);
    });

    // this will handle the message after connecting to the server
    // updating the rooms
    socket.on('message', function(message) {
        let data = message;
        $('#total_users').text('Total number of users in the server: '+data['total_users']);
        if(data['rooms'].length > 0){
            let output = "";
            for(let i=0;i<data['rooms'].length;i++){
                output +=
                '<div class="card my-2">' +
                    '<div class="card-body clearfix"> ' +                 
                        '<div class="float-left">'+data['rooms'][i]['room_name']+'</div>' +
                        '<div class="float-right">' +
                            '<button type="button" class="btn btn-primary" onclick=join_room('+data['rooms'][i]['room_id']+') data-dismiss="modal">Join room</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            }
            $('#rooms').html(output);
        }else{
            let output = '<div class="text-center mt-5">'+'No rooms at the moment.'+'</div>';
            $('#rooms').html(output);
        }
    }); 

    // Sends "someone in this room disconnects" message to chat room the user joined
    socket.on('disconnect', function(message) {
        $('#total_users').text('Total number of users in the server: '+message);
        let logout_message = '<li>'+
                '<div class="d-flex justify-content-center mb-3">'+
                    '<div class="w-75 border border-dark rounded-lg p-2">Someone in this room disconnects.</div>'+
                '</div>'+
        '</li>';    
        $('#messages').append(logout_message);
    });

    // loads room messages when use joined a room
    socket.on('load_messages', function(message){
        console.log(message);
        let saved_messages = "";
        for(let i=0;i<message['messages'].length;i++){
            saved_messages +=
            '<li>'+
                '<div class="d-flex justify-content-start mb-3">'+
                    '<div class="w-75 border border-danger rounded-lg p-2">'+
                        '<strong>'+ message['messages'][i]['sender'] +'</strong><br>'+
                        message['messages'][i]['message'] +
                    '</div>'+
                '</div>'+
            '</li>';
        }
        $('#messages').append(saved_messages);
        $('#selected_room_name').text(message['room_name']);
    });

    // Sends a "user joined message" to chat room when user joined
    socket.on('joined', function(message) {
        let join_message = 
        '<li>'+
            '<div class="d-flex justify-content-center mb-3">'+
                '<div class="w-75 border border-success rounded-lg p-2">'+ message +'</div>'+
            '</div>'+
        '</li>';
        $('#messages').append(join_message);
    });

    // Sends a "user left message" to chat room when user leave the room
    socket.on('leave', function(message) {
        let output = 
        '<li>'+
            '<div class="d-flex justify-content-center mb-3">'+
                '<div class="w-75 border border-dark rounded-lg p-2">'+ message +'</div>'+
            '</div>'+
        '</li>';
        $('#messages').append(output);
    });

    // Sends "someone disconnects" to chat room
    socket.on('logout', function(message) {
        let output = 
        '<li>'+
            '<div class="d-flex justify-content-center mb-3">'+
                '<div class="w-75 border border-dark rounded-lg p-2">'+ message +'</div>'+
            '</div>'+
        '</li>';
        $('#messages').append(output);
    });

    // Sends a "user delete the room message" when user a deletes the room
    socket.on('delete', function(message) {
        let output = 
        '<li>'+
            '<div class="d-flex justify-content-center mb-3">'+
                '<div class="w-75 border border-danger rounded-lg p-2">'+
                        message +
                 '</div>'+
            '</div>'+
        '</li>';            
        $('#messages').append(output);
    });

    // Sets the current user chat to right while other members on the left
    socket.on('chat', function(message) {
        let output;
        if(message['current_user']==$('#current_user_id').val()){
            output = 
                '<li>'+
                    '<div class="d-flex justify-content-end mb-3">'+
                        '<div class="w-75 border border-primary rounded-lg p-2">'+
                            '<strong>You</strong><br>'+
                                message['message'] +
                        '</div>'+
                    '</div>'+
                '</li>';
        }else{
            output = 
                '<li>'+
                    '<div class="d-flex justify-content-start mb-3">'+
                        '<div class="w-75 border border-danger rounded-lg p-2">'+
                            '<strong>'+ message['sender'] +'</strong><br>'+
                                message['message'] +
                        '</div>'+
                    '</div>'+
                '</li>';            
        }
        $('#messages').append(output);
        shouldScroll = messages_container.scrollTop + messages_container.clientHeight === messages_container.scrollHeight;
        if (!shouldScroll) {
            scrollToBottom();
        }
    });

    $('#create').click(function(){
        let room_name = $('#room_name').val();
        $('#room_name').val('');
        socket.emit('create',room_name);
    });

    $('#send').click(function(){
        let message = $('#send_message').val();
        let sender = $('#current_user').val();
        let room = $('#selected_room_name').text();
        let room_id = $('#current_room_id').val();
        let user_id = $('#current_user_id').val();
        $('#send_message').val('');
        if(message && sender && room && room_id && user_id){
            socket.emit('chat',{'message_body': message, 'sender': sender, 'room': room, 'room_id': room_id, 'current_user': user_id})
        }
    });
});

function scrollToBottom() {
    messages_container.scrollTop = messages_container.scrollHeight;
}

// user joins a room; adds delete and leave button; add ul tag for messages to append
function join_room(room_id){
    $('#current_room_id').val(room_id);
    socket.emit('join_room',{'username': $('#current_user').val(), 'room_id': room_id});
    let chatheader =
        '<div class="border p-2 my-2">'+
                '<div class="text-center" id="selected_room_name">'+
                '</div>'+
                '<div class="text-center mt-2">'+
                    '<button type="button" class="btn btn-warning btn-sm mx-1" onclick=delete_room('+room_id+')>Delete</button>'+
                    '<button type="button" class="btn btn-danger btn-sm mx-1" onclick=leave_room('+room_id+')>Leave</button>'+        
                '</div>'+
        '</div>';
    let chatbox = 
        '<ul style="list-style-type:none;padding: 0;" id="messages" class="mt-3">'+
        '</ul>';
    $('#chat_header').html(chatheader);
    $('#chat_box').html(chatbox);
    scrollToBottom();
}

function leave_room(room_id){
    $('#current_room_id').val('');
    socket.emit('leave',{'username': $('#current_user').val(), 'room_id': room_id});
    let output = 
        '<div class="text-center mt-2">'+
            '<p>No room selected.</p>'+
        '</div>';
    $('#chat_header').html('');
    $('#chat_box').html(output);
}

function delete_room(room_id){
    $('#current_room_id').val('');
    socket.emit('delete',{'username': $('#current_user').val(), 'room_id':room_id});
    let output = 
        '<div class="text-center mt-2">'+
            '<p>No room selected.</p>'+
        '</div>';
    $('#chat_header').html('');
    $('#chat_box').html(output);
}