var socket; 
var socketid;

function subscribe(uri, query, variables = null, callback) { 
  if (!socket) {
    socket = io(uri);
    socket.on('init', ({id}) => {
      socketid = id;
      socket.on(socketid, (data) => { callback(data) });
      socket.emit(socketid, { query });
    });
  }
}

function unsubscribe() { 
  socket.emit('unsubscribe', { socketid });
}

function graphql(uri, query, variables, callback){
  socket.emit('mutation', { query });
}

subscribe('http://localhost:4000', '{ getMessage(id: 0) { content, author} }', null, function (data) {
  console.log(data);
});