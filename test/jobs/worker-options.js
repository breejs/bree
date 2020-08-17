const { parentPort } = require('bthreads');

if (parentPort) parentPort.postMessage(process.argv[2]);
