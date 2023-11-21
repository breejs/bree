import { parentPort } from 'node:worker_threads';
import process from 'node:process';

console.log('Hello ESM!');

// signal to parent that the job is done
if (parentPort) parentPort.postMessage('done');
else process.exit(0);
