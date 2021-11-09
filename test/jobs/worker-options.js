const process = require('process');
const { parentPort } = require('worker_threads');

if (parentPort) parentPort.postMessage(process.argv[2]);
