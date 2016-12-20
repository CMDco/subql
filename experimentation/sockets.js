var socket; 
var socketid;

function subscribe(uri, query, variables = null, callback) { 
  console.log(`subscribing to ${query}`);
  if (!socket) {
    socket = io(uri);
    socket.on('init', ({id}) => {
      socketid = id;
      socket.on(socketid, (data) => { callback(data) });
      socket.emit(socketid, { query });
    });
  }else{
    socket.emit(socketid, {query});
  }
}

function unsubscribe() { 
  socket.emit('unsubscribe', { socketid });
}

    // subscribe(null, `
    // {
    //   getMessage(id: 0){
    //     id, content, author
    //   }
    // }
    // `, null, function (data) {
    //   console.log(data);
    // });

//subscribe(null, '{ getMessages(id: 0, test:"testarg", another:"anotherarg", something:"somethingarg"){content, author} }', null, function (data) {

// subscribe(null, `
// {
//   getMessage(id: 0){
//     id
//     content
//     author
//     date{
//       year
//     }
//   }
//   getMessages{
//     content
//     date{
//       day
//     }
//   }
// }
// `, null, function (data) {
//   console.log(data);
// });
