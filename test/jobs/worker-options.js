const process = require('node:process');
const { parentPort } = require('node:worker_threads');

if (parentPort) parentPort.postMessage(process.argv[2]);
