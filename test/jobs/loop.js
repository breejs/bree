const process = require('node:process');
const { parentPort } = require('node:worker_threads');

setInterval(() => {}, 1000);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'error') throw new Error('oops');
    if (message === 'cancel') {
      parentPort.postMessage('cancelled');
      return;
    }

    parentPort.postMessage(message);
    process.exit(0);
  });
}
