var express = require('express');
var graphqlHTTP = require('express-graphql');
var app = express();
var server = require('http').Server(app);
var { buildSchema } = require('graphql');
var { parseSchema, registerResolver, registerType, getRoot } = require('../src/subql.js');
var { setup } = require('../src/sockets.js');
 
parseSchema(`
  input MessageInput {
    content: String
    author: String
  }

  type Message {
    id: ID!
    content: String
    author: String
  }

  type Query {
    getMessage(id: ID!): Message
    getMessages(id: ID!): [Message]
  }

  type Mutation {
    createMessage(input: MessageInput): Message
    updateMessage(id: ID!, input: MessageInput): Message
  }
`);

// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
  input MessageInput {
    content: String
    author: String
  }

  type Message {
    id: ID!
    content: String
    author: String
  }

  type Query {
    getMessage(id: ID!): Message
    getMessages(id: ID!): [Message]
  }

  type Mutation {
    createMessage(input: MessageInput): Message
    updateMessage(id: ID!, input: MessageInput): Message
  }
`);

// If Message had any complex fields, we'd put them on this object.
class Message {
  constructor(id, {content, author}) {
    this.id = id;
    this.content = content;
    this.author = author;
  }
}

registerType(Message, 'id', 'author');
// Maps username to content
var fakeDatabase = {
    0 : {
      content: "cesar is cool",
      author: "dean"
    }
};

// var root = {
//   getMessage: function ({id}) {
//     if (!fakeDatabase[id]) {
//       throw new Error('no message exists with id ' + id);
//     }
//     return new Message(id, fakeDatabase[id]);
//   },
//   createMessage: function ({input}) {
//     // Create a random id for our "database".
//     var id = require('crypto').randomBytes(10).toString('hex');

//     fakeDatabase[id] = input;
//     return new Message(id, input);
//   },
//   updateMessage: function ({id, input}) {
//     if (!fakeDatabase[id]) {
//       throw new Error('no message exists with id ' + id);
//     }
//     // This replaces all old data, but some apps might want partial update.
//     fakeDatabase[id] = input;
//     return new Message(id, input);
//   },
// }

function getMessage({id}) {
  if (!fakeDatabase[id]) {
    throw new Error('no message exists with id ' + id);
  }
  return new Message(id, fakeDatabase[id]);
}
function createMessage({input}) {
  var id = require('crypto').randomBytes(10).toString('hex');

  fakeDatabase[id] = input;
  return new Message(id, input);
}
function updateMessage({id, input}) {
  if (!fakeDatabase[id]) {
    throw new Error('no message exists with id ' + id);
  }
  // This replaces all old data, but some apps might want partial update.
  fakeDatabase[id] = input;
  return new Message(id, input);
}
function getMessages(){
  return Object.keys(fakeDatabase).reduce((acc, curr) =>{
    acc.push(fakeDatabase[curr]);
    return acc;
  }, []);
}
registerResolver(getMessage, getMessages, createMessage, updateMessage);
var root = getRoot();

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

setup(server);

app.get('/', (req, res) => { 
  res.sendFile(__dirname + '/index.html')
})
app.get('/sockets.js', (req, res) => { 
  res.sendFile(__dirname + '/sockets.js')
})

server.listen(4000, () => {
  console.log('Running a GraphQL API server at localhost:4000/graphql');
});