const { parentPort } = require('bthreads');

setInterval(() => {}, 10);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'error') throw new Error('oops');
    if (message === 'cancel') {
      parentPort.postMessage('cancelled');
      return;
    }

    parentPort.postMessage(message);
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(0);
  });
}
