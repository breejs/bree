const os = require('os');
const process = require('process');
const { parentPort } = require('worker_threads');

const Cabin = require('cabin');
const Email = require('email-templates');
const pMap = require('p-map');

//
// we recommend using Cabin as it is security-focused
// and you can easily hook in Slack webhooks and more
// <https://cabinjs.com>
//
const logger = new Cabin();

//
// we recommend using email-templates to
// create, send, and manage your emails
// <https://email-templates.js.org>
//
const email = new Email({
  message: {
    // set a default from that will be set on all messages
    // (unless you specifically override it on an individual basis)
    from: 'elon@tesla.com'
  }
});

// store boolean if the job is cancelled
let isCancelled = false;

// how many emails to send at once
const concurrency = os.cpus().length;

// example database results
const results = [
  {
    template: 'welcome',
    message: {
      to: 'elon@spacex.com'
    },
    locals: {
      foo: 'bar',
      beep: 'boop'
    }
  }
  // ...
];

async function mapper(result) {
  // return early if the job was already cancelled
  if (isCancelled) return;
  try {
    const response = await email.send(result);
    logger.info('sent email', { response });
    // here is where you would write to the database that it was sent
    return response;
  } catch (err) {
    // catch the error so if one email fails they all don't fail
    logger.error(err);
  }
}

// handle cancellation (this is a very simple example)
if (parentPort)
  parentPort.once('message', (message) => {
    //
    // TODO: once we can manipulate concurrency option to p-map
    // we could make it `Number.MAX_VALUE` here to speed cancellation up
    // <https://github.com/sindresorhus/p-map/issues/28>
    //
    if (message === 'cancel') isCancelled = true;
  });

(async () => {
  // query database results for emails not sent
  // and iterate over them with concurrency
  await pMap(results, mapper, { concurrency });

  // signal to parent that the job is done
  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
})();
