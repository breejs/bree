const { parentPort, workerData } = require('bthreads');

if (parentPort) parentPort.postMessage(workerData);
