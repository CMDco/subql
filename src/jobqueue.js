const Rx = require('rxjs');
const hash = require('object-hash');

class JobQueue {
  constructor() {
    this.jobQueue = [];
    this.watchdogs = {};
  }

  addJob(job) {
    this.jobQueue.push(job);
  }

  takeJob() {
    return this.jobQueue.splice(0,1)[0];
  }

  getJobs() {
    return this.jobQueue;
  }

  countJobs() {
    return this.jobQueue.length;
  }

  addObservable(name, callback, errCallback, completeCallback, loopback=true, interval = 100) {
    if(!this.watchdogs[name]) {
      let subscribeCallback = (intervalTime) => {
        if(this.jobQueue.length > 0) {
          let currJob = this.takeJob();
          callback(currJob);
          if(loopback) {
            this.addJob(currJob);
          }
        }
      }
      this.watchdogs[name] = new Rx.Observable.interval(interval);
      this.watchdogs[name].subscribe(subscribeCallback, errCallback, completeCallback);
    }
    return this.watchdogs[name];
  }

    getObervables() {
    return this.watchdogs;
  }

  countObservables() {
    return Object.keys(this.watchdogs).length;
  }
}

class Job {
  constructor(pName, pTask, pCallback) {
    this.name = pName;
    this.storedTask = pTask;
    this.task = (...args) => { 
      let result = this.storedTask(...args);
      if(this.diffResult(result, this.lastResult)) {
        this.callback(result);
        this.lastResult = hash(sortObject(result));
      }
      this.numPolls++;
      return result;
    };
    this.callback = pCallback;
    this.numPolls = 0;
    this.lastResult;
  }

  getName() {
    return this.name;
  }

  runTask(...args) {
    return this.task(...args);
  }

  getTask() {
    return this.task;
  }

  getNumPolls() {
    return this.numPolls;
  }

  diffResult(newObject, lastHash) {
    if(this.numPolls < 1) {
      this.lastResult = hash(sortObject(newObject));
      return false;
    }
    return hash(sortObject(newObject)) !== this.lastResult;
  }
}

// Private
function sortObject(object) {  
  let sortedObj = {};
  let keys = Object.keys(object);
  keys.sort(function(key1, key2) {
    key1 = key1.toLowerCase(), key2 = key2.toLowerCase();
    if(key1 < key2) return -1;
    if(key1 > key2) return 1;
    return 0;
  });
  for(let index in keys) {
    let key = keys[index];
    if(typeof object[key] == 'object' && !(object[key] instanceof Array)) {
        sortedObj[key] = sortObject(object[key]);
    } else {
        sortedObj[key] = object[key];
    }
  }
  return sortedObj;
}

module.exports = { JobQueue, Job };
