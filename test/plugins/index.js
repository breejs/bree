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

test('successfully add plugin', (t) => {
  t.plan(2);

  const plugin = (_, c) => {
    c.prototype.test = () => {
      t.pass();
    };
  };

  Bree.extend(plugin);

  t.is(plugin.$i, true);

  const bree = new Bree({ ...baseConfig });

  bree.test();
});

test('successfully add plugin with options', (t) => {
  t.plan(1);

  const plugin = (options, c) => {
    c.prototype.test = () => {
      if (options.test) {
        t.pass();
      } else {
        t.fail();
      }
    };
  };

  Bree.extend(plugin, { test: true });

  const bree = new Bree({ ...baseConfig });

  bree.test();
});

test('only adds plugin once', (t) => {
  t.plan(2);

  let count = 0;

  const plugin = (_, c) => {
    if (count === 1) {
      t.fail();
    }

    count++;

    c.prototype.test = () => {
      t.pass();
    };
  };

  Bree.extend(plugin);

  t.is(plugin.$i, true);

  Bree.extend(plugin);

  const bree = new Bree({ ...baseConfig });

  bree.test();
});
