const { parentPort } = require('worker_threads');
const delay = require('delay');

(async () => {
  await delay(1);

  if (parentPort) {
    parentPort.postMessage('get ready');
    await delay(10);
    parentPort.postMessage('done');
  }
})();
