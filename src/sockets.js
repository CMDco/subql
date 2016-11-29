var io;// = require('socket.io');
var http = require('http')
const connected = {};
var { handleSubscribe } = require('./cabotage.js');

function setup(server) { 
  io = require('socket.io')(server);
  io.on('connection', function (socket) {
    connected[socket.id] = socket;
    socket.emit('init', { id: socket.id });
    socket.on(socket.id, function (query) {
      handleSubscribe(query, socket.id);
    });
  }); 
}

module.exports = { setup };