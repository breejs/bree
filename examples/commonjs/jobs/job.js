const { parentPort } = require('node:worker_threads');
const process = require('node:process');

console.log('Hello Commonjs!');

// signal to parent that the job is done
if (parentPort) parentPort.postMessage('done');
else process.exit(0);
