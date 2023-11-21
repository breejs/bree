const process = require('node:process');
const { parentPort } = require('node:worker_threads');

setInterval(() => {}, 10);

if (parentPort) {
  parentPort.on('message', (message) => {
    if (message === 'cancel') {
      process.exit(0);
    }
  });
}
