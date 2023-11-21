const process = require('node:process');
const { parentPort } = require('node:worker_threads');

const delay = require('delay');

setInterval(() => {}, 10);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'error') throw new Error('oops');
    if (message === 'cancel') {
      parentPort.postMessage('cancelled');
      return;
    }

    parentPort.postMessage(message);
    delay(10).then(() => process.exit(0));
  });
}
