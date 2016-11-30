var io;
var http = require('http')
var { handleSubscribe, handleDisconnect } = require('./cabotage.js');
var { connected } = require('./socketdata.js');

const debugLog = false;

function setup(server) { 
  io = require('socket.io')(server);
  io.on('connection', function (socket) {
    connected[socket.id] = socket;
    socket.emit('init', { id: socket.id });
    socket.on(socket.id, function (query) {
      debug(`socket.on(${socket.id}) :: [${socket.id}] made subscription request`);
      handleSubscribe(query, socket.id);
    });
    socket.on('disconnect', function(){
      handleDisconnect(socket.id);
      debug(`socket.on(disconnect) :: [${socket.id}] disconnected`);
    });
  }); 
}

function debug(debugStr){
  if(debugLog) console.log(debugStr);
}

module.exports = { setup };