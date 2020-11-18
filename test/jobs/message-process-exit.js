const { parentPort } = require('bthreads');

setInterval(() => {}, 10);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'cancel') {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(0);
    }
  });
}
