const Rx = require('rxjs');

class JobQueue{
  constructor(){
    this.jobQueue = [];
    this.watchdogs = {};
  }

  addJob(job){
    this.jobQueue.push(job);
  }
  takeJob(){
    return this.jobQueue.splice(0,1)[0];
  }
  getJobs(){
    return this.jobQueue;
  }
  countJobs(){
    return this.jobQueue.length;
  }

  addObservable(name, callback, errcallback, completecallback, interval = 2000){
    if(!this.watchdogs[name]){
      let subscribeCallback = (intervalTime) => {
        if(this.jobQueue.length > 0){
          let currJob = this.takeJob();
          callback(currJob);
          this.addJob(currJob);
        }
        this.watchdogs[name] = new Rx.Observable.interval(interval);
        this.watchdogs[name].subscribe(subscribeCallback, errcallback, completecallback);
      }
    }
    return this.watchdogs[name];
  }

    getObervables(){
    return this.watchdogs;
  }

  countObservables(){
    return Object.keys(this.watchdogs).length;
  }
}

// takes a name, task and callback(result)
class Job{
  constructor(pName, pTask, pCallback){
    this.name = pName;
    this.storedTask = pTask;
    this.task = (...args) => { 
      this.numPolls++; 
      let result = this.storedTask(...args);
      if(this.diffResult(result, this.lastResult)){
        this.callback(result);
        this.lastResult = result; // TODO hash lastResult when storing
      }
      return result;
    };
    this.callback = pCallback;
    this.numPolls = 0;
    this.lastResult;
  }
  getName(){
    return this.name;
  }
  runTask(...args){
    return this.task(...args);
  }
  getTask(){
    return this.task;
  }
  getNumPolls(){
    return this.numPolls;
  }
  diffResult(newObject, lastHash){
    // TODO: hash
    // return hash(newObject) !== lastHash;
    if(this.numPolls <= 1){
      this.lastHash = newObject; // TODO hash(newObject);
      return false;
    }
    return newObject !== lastHash;
  }
}

//debug method
function handleJob(job, tick){
  if(tick) console.log(`tick ${tick} ===========================`);
  console.log(job);
  console.log(job.name);
  console.log(job.task);
}


/* temp: debug code for jobs/ jobqueue
let i = 0;
let j = new Job("name", () => {console.log(`task ${i} run`); return i++;}, () => {console.log(`callback diff!`)});
console.log(`runTask: ${j.runTask()}`);
console.log(`runTask: ${j.runTask()}`);
console.log(`runTask: ${j.runTask()}`);
console.log(`runTask: ${j.runTask()}`);
console.log(`runTask: ${j.runTask()}`);
console.log(`runTask: ${j.runTask()}`);
console.log(`runTask: ${j.runTask()}`);

let jobqueue = new JobQueue();
let s = 0;
let u = 100;
let b = 200;
let q = 300;
let l = 400;

let js = new Job("name", () => {console.log(`task ${1} run`); return s++;}, () => {console.log(`callback diff!`)});
let ju = new Job("name", () => {console.log(`task ${2} run`); return u++;}, () => {console.log(`callback diff!`)});
let jb = new Job("name", () => {console.log(`task ${3} run`); return b++;}, () => {console.log(`callback diff!`)});
let jq = new Job("name", () => {console.log(`task ${4} run`); return q++;}, () => {console.log(`callback diff!`)});
let jl = new Job("name", () => {console.log(`task ${5} run`); return l++;}, () => {console.log(`callback diff!`)});

jobqueue.addJob(js);
jobqueue.addJob(ju);
jobqueue.addJob(jb);
jobqueue.addJob(jq);
jobqueue.addJob(jl);


jobqueue.addObservable("name", (job) => {
    console.log(` FIRST OBSERVABLE ${job.runTask()}`);
  }, (err) => console.log(err), () => console.log('complete'));

jobqueue.addObservable("name2", (job) => {
    console.log(` SECON OBSERVABLE ${job.runTask()}`);
  }, (err) => console.log(err), () => console.log('complete'));
  */