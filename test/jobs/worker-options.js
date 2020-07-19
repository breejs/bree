const { parentPort } = require('worker_threads');

if (parentPort) parentPort.postMessage(process.argv[2]);
