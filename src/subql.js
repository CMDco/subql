const graphql = require('graphql'); 
const { connected } = require('./socketdata.js');
const {JobQueue, Job} = require('./jobqueue.js');

const db = {};
const mroot = {};
const otypes = {};
const operations = {};
var storedSchema = '';
var jobQueue = new JobQueue();
jobQueue.addObservable("observable1", (job) => job.runTask(), (err) => console.log(err), () => console.log('complete'));
jobQueue.addObservable("observable2", (job) => job.runTask(), (err) => console.log(err), () => console.log('complete'));
jobQueue.addObservable("observable3", (job) => job.runTask(), (err) => console.log(err), () => console.log('complete'));
jobQueue.addObservable("observable4", (job) => job.runTask(), (err) => console.log(err), () => console.log('complete'));

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

function registerType(classFn, ...uniqKeys) {
  if(typeof classFn !== 'function') {
    throw new Error('registerType :: registerType must take in a constructor function as first argument');
  }
  if(!uniqKeys) {
    throw new Error('registerType :: registerType did not recieve any keys as arguments');
  }
  otypes[classFn.name] = {
    name: classFn.name,
    classType: classFn,
    keys: uniqKeys,
  };
}

function registerResolver(...rootFn) {
  if(!rootFn) {
    throw new Error('registerResolver :: registerResolver must take at least one resolver function.');
  }
  rootFn.forEach((fn) => {
    if(fn.name.length <= 0) {
      throw new Error('registerResolver :: registerResolver can not take anonymous functions as arguments');
    }
    mroot[fn.name] = wrapResolver(fn);
  });
}

/**
 * wrapResolver will add the trigger functionality to notify clients
 * for operations of type Mutation and not ListTypes
 */
function wrapResolver(fn) {
  if(operations[fn.name].type === 'Mutation' && operations[fn.name].kind !== 'ListType') {
    return function (...args) {
      let ret = fn(...args);
      triggerType(ret.constructor.name, ret);
      return ret;
    }
  } else {
    return fn;
  }
}

function getSchema(){
  return storedSchema;
}

function getRoot() {
  return mroot;
}

/**
 * handleSubscribe takes a query string and a socket it
 * It will store the proper information necesary to allow mutations to
 * use the socketid to notify clients about updates to data
 */
function handleSubscribe(query, socketid) {
  const root = Object.assign({}, getRoot());
  const parseQuery = graphql.parse(query.query);
  let queryOperations = getOperationNames(parseQuery);
  connected[socketid].query = query.query;
  connected[socketid].operationFields = findFields(parseQuery, {});


  queryOperations.forEach((resolverName) => {
    if(operations[resolverName].kind === 'ListType') {
      let queries = parseQuery.definitions.reduce((acc, curr) => {
        return curr.operation === 'query' ? curr : acc;
      }, { selectionSet: { selections: [] } });
      let currentSelection = queries.selectionSet.selections.reduce((acc, curr) => {
        return curr.name.value === resolverName ? curr : acc;
      }, {});
      let inputs = currentSelection.arguments.reduce((acc, curr) => {
        acc[curr.name.value] = curr.value.value;
        return acc;
      }, {});
      jobQueue.addJob(new Job(
        resolverName + JSON.stringify(inputs),
        () => root[resolverName](inputs),
        (result) => connected[socketid] !== undefined
          ? connected[socketid].socket.emit(socketid, result.map(val => queryFilter(val, connected[socketid])))
          : console.log(`[Job] :: client has disconnected`),
        socketid
      ));
    } else if(operations[resolverName].type === 'Query') {
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
    if(connected[socketid]){
      connected[socketid].socket.emit(socketid, result);
    }else{
      // client has disconnected.
      // TODO add in logic for removing data about disconnected client
    }
  });
}

function getOperationNames(parsedQuery) {
  let results = [];
  parsedQuery.definitions.forEach( (definition) => {
    if(definition.operation === 'query'){
      definition.selectionSet.selections.forEach((curr) => {
        results.push(curr.name.value);
      });
    }
  });
  return results;
}

/**
 * Traverses through the parsed query and retrieves all the resolver names (fields)
 */
function findFields(parsedQuery, store) {
  let collection = parsedQuery.definitions[0].selectionSet.selections;
  function findFieldshelper(val, store) {
    store[val.name.value] = [];
    val.selectionSet.selections.forEach(field => {
      if (field.selectionSet) {
        store[val.name.value].push(findFieldshelper(field, {}));
      } else {
        store[val.name.value].push(field.name.value);
      }
    });
    return store;
  }
  collection.forEach((val) => {
    findFieldshelper(val, store);
  });
  return store;
}

function handleDisconnect(socketid) {
  jobQueue.removeJob('identifier', socketid);
  Object.keys(db).forEach((uniqIdentifier) => {
    let socketIndex = db[uniqIdentifier].indexOf(socketid);
    if(socketIndex >= 0) {
      db[uniqIdentifier].splice(socketIndex, 1);
    }
  });
  delete connected[socketid];
}

function triggerType(typename, resolverResult) {
  if(otypes[typename] === undefined) {
    throw new Error(`triggerType :: There exists no registered type named ${typename}`);
  }
  let uniqIdentifier = generateUniqueIdentifier(typename, resolverResult);
  if(db[uniqIdentifier] !== undefined) {
    db[uniqIdentifier].forEach((socket) => {
      if (connected[socket] !== undefined) {
        connected[socket].socket.emit(socket, queryFilter(resolverResult, connected[socket]));
      }
    });
  }
};

function queryFilter(resolverResult, clientObj) {
  let typeOfObj = resolverResult.constructor.name;
  let resolverNames = Object.keys(clientObj.operationFields);
  let matchedResolver;
  resolverNames.forEach((resolver) => {
    if (operations[resolver].value === typeOfObj && operations[resolver].kind === "NamedType") {
      matchedResolver = resolver;
    } else if(operations[resolver].value === typeOfObj){ 
      matchedResolver = resolver;
    }
  });
  let retObjectTemplate = { data: {} };
  retObjectTemplate.data[matchedResolver] = {};
  let fields = clientObj.operationFields[matchedResolver];
  fields.forEach((field) => {
    if (typeof field === 'object') { 
      let key = Object.keys(field)[0];
      if (!Array.isArray(resolverResult[key])) {
        retObjectTemplate.data[matchedResolver][key] = nestedQueryHelper(field[key], resolverResult[key], {});
      } else { 
        retObjectTemplate.data[matchedResolver][key] = resolverResult[key].map(ele => nestedQueryHelper(field[key], ele, {}));
      }
    } else {
      retObjectTemplate.data[matchedResolver][field] = resolverResult[field]; 
    }
  });
  return retObjectTemplate;
}

function nestedQueryHelper(fieldArray, resolverObj, resultObj) { //TODO can we possibly refactor with similar code in query filter
  fieldArray.forEach((key) => {
    if(typeof key === 'object') {
      let fieldKey = Object.keys(key)[0];
      if (!Array.isArray(resolverObj[fieldKey])) {
        resultObj[fieldKey] = nestedQueryHelper(key[fieldKey], resolverObj[fieldKey], {});
      } else { 
        resultObj[fieldKey] = resolverObj[fieldKey].map(ele => nestedQueryHelper(key[fieldKey], ele, {}));
      }
    } else {
      resultObj[key] = resolverObj[key];
    }
  });
  return resultObj;
}

function generateUniqueIdentifier(typename, resolverResult) {
  if(otypes[typename] === undefined) {
    throw new Error(`generateUniqueIdentifier :: There exists no registered type named ${typename}`);
  }
  let uniqKeys = otypes[typename].keys;
  return typename + uniqKeys.reduce((acc, curr) => {
    return acc + curr + resolverResult[curr];
  }, '');
}

module.exports = {
  registerResolver,
  getRoot,
  getSchema,
  registerType,
  parseSchema,
  handleSubscribe,
  handleDisconnect,
  triggerType
};