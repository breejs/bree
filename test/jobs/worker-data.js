const { parentPort, workerData } = require('node:worker_threads');

if (parentPort) parentPort.postMessage(workerData);
