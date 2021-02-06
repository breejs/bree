const { parentPort } = require('bthreads');

setInterval(() => {}, 10);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'cancel') {
      process.exit(0);
    }
  });
}
