const path = require('path');
const test = require('ava');

const Bree = require('../../src');

const root = path.join(__dirname, '..', 'jobs');
const baseConfig = {
  root,
  timeout: 0,
  interval: 0,
  hasSeconds: false,
  defaultExtension: 'js'
};

test('plugin can extend init', async (t) => {
  t.plan(3);

  const plugin = (_, c) => {
    const origInit = c.prototype.init;

    c.prototype.init = function () {
      origInit.bind(this)();

      t.pass();
    };
  };

  Bree.extend(plugin);

  t.is(plugin.$i, true);

  const bree = new Bree({ ...baseConfig });
  await bree.init();

  t.true(bree instanceof Bree);
});
