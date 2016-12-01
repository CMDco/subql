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
        let uniqKeys = otypes[ret.constructor.name].keys;
        let uniqIdentifier = uniqKeys.reduce((acc, curr) => {
          return acc + curr + ret[curr];
        }, '');
        db[uniqIdentifier].forEach((socket) => {
          if(connected[socket] !== undefined){ // db[uniqIdentifier] is an array
            db[uniqIdentifier].forEach((socketid) => {
              connected[socketid].emit(socketid, ret);
            });
          }
        });
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
          value: field.type.name.value
        }
      });
    }
  });
}

function handleSubscribe(query, socketid) {
  const root = Object.assign({}, getRoot());
  Object.keys(root).forEach((resolverName) => {
    if (operations[resolverName].type === 'Query') {
      let oldResolver = root[resolverName];
      root[resolverName] = function (...args) {
        let ret = oldResolver(...args);
        let uniqKeys = otypes[operations[resolverName].value].keys;
        let uniqIdentifier = uniqKeys.reduce((acc, curr) => {
          return acc + curr + ret[curr];
        }, '');
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
    connected[socketid].emit(socketid, result);
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

module.exports = {
  registerResolver,
  getRoot,
  registerType,
  parseSchema,
  handleSubscribe,
  handleDisconnect
};