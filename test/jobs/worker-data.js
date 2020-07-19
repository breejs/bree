const { parentPort, workerData } = require('worker_threads');

if (parentPort) parentPort.postMessage(workerData);
