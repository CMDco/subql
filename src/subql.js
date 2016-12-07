const graphql = require('graphql'); 
var { connected } = require('./socketdata.js');

const db = {};
const mroot = {};
const otypes = {};
const operations = {};
var storedSchema = '';

function registerResolver(...rootFn){
  if(!rootFn){
    throw new Error('registerResolver :: registerResolver must take at least one resolver function.');
  }
  rootFn.forEach((fn) => {
    if(fn.name.length <= 0){
      throw new Error('registerResolver :: registerResolver can not take anonymous functions as arguments');
    }
    mroot[fn.name] = wrapResolver(fn);
  });
}

function getRoot(){
  return mroot;
}

function wrapResolver(fn){
  if(operations[fn.name].type === 'Mutation'){
    return function (...args){
      let ret = fn(...args);
      if(operations[fn.name].type === 'Mutation'){
        triggerType(ret.constructor.name, ret)
      }
      return ret;
    }
  }else{
    return fn;
  }
}

function registerType(classFn, ...uniqKeys){
  if(typeof classFn !== 'function'){
    throw new Error('registerType :: registerType must take in a constructor function as first argument');
  }
  if(!uniqKeys){
    throw new Error('registerType :: registerType did not recieve any keys as arguments');
  }
  otypes[classFn.name] = {
    name: classFn.name,
    classType: classFn,
    keys: uniqKeys,
  };
}

function parseSchema(schema) {
  if (!schema) {
    throw new Error('parseSchema :: parseSchema must take in a schema string');
  }
  storedSchema = schema;
  let schemaSource = new graphql.Source(schema);
  let parsedSchema = graphql.parse(schema);
  parsedSchema.definitions.forEach((ele) => {
    if (ele.name.value === 'Query' || ele.name.value === 'Mutation') {
      ele.fields.forEach((field) => {
        operations[field.name.value] = {
          name: field.name.value,
          type: ele.name.value,
          // for List Types, field.type.kind defines a list type and field.type.type.kind defines the named type
          value: field.type.kind === "ListType" ? field.type.type.name.value : field.type.name.value,
          kind: field.type.kind
        }
      });
    }
  });
}
function findFields(obj, store) {
  var collection = obj.definitions[0].selectionSet.selections
  function findFieldshelper(val, store) {
    store[val.name.value] = []
    val.selectionSet.selections.forEach(field => { 
      if (field.selectionSet) {
        store[val.name.value].push(findFieldshelper(field, {}))
      }
      else store[val.name.value].push(field.name.value)
    });
    return store
   }
  collection.forEach((val) => {
    findFieldshelper(val, store)
  });
 }
function handleSubscribe(query, socketid) {
  const root = Object.assign({}, getRoot());
  connected[socketid].query = query.query
  const parseQuery = graphql.parse(query.query);
  connected[socketid].operationFields = {};
  findFields(parseQuery, connected[socketid].operationFields)
  Object.keys(root).forEach((resolverName) => {
    if (operations[resolverName].type === 'Query') {
      let oldResolver = root[resolverName];
      root[resolverName] = function (...args) {
        let ret = oldResolver(...args);
        let uniqIdentifier = generateUniqueIdentifier(operations[resolverName].value, ret);
        db[uniqIdentifier] = !db[uniqIdentifier] ? [socketid] : [...db[uniqIdentifier], socketid];
        return ret;
      }
    }
  });

  graphql.graphql(
    graphql.buildSchema(storedSchema),
    query.query,
    root
  ).then((result) => {
    connected[socketid].socket.emit(socketid, result);
  });
}

function handleDisconnect(socketid){
  Object.keys(db).forEach( (uniqIdentifier) => {
    let socketIndex = db[uniqIdentifier].indexOf(socketid);
    if(socketIndex >= 0){
      db[uniqIdentifier].splice(socketIndex, 1);
    }
  });
  delete connected[socketid];
}

function triggerType(typename, obj){
  if(otypes[typename] === undefined){
    throw new Error(`triggerType :: There exists no registered type named ${typename}`);
  }
  let uniqIdentifier = generateUniqueIdentifier(typename, obj);
  db[uniqIdentifier].forEach((socket) => {
    if(connected[socket] !== undefined){
      db[uniqIdentifier].forEach((socketid) => {
        connected[socketid].emit(socketid, obj);
      });
    }
  });
}

function generateUniqueIdentifier(typename, obj){
  if(otypes[typename] === undefined){
    throw new Error(`generateUniqueIdentifier :: There exists no registered type named ${typename}`);
  }
  let uniqKeys = otypes[typename].keys;
  return typename + uniqKeys.reduce((acc, curr) => {
    return acc + curr + obj[curr];
  }, '');
}

module.exports = {
  registerResolver,
  getRoot,
  registerType,
  parseSchema,
  handleSubscribe,
  handleDisconnect,
  triggerType
};