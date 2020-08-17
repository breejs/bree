const delay = require('delay');
const { parentPort } = require('bthreads');

(async () => {
  await delay(1);

  if (parentPort) {
    parentPort.postMessage('get ready');
    parentPort.postMessage('done');
  }
})();
