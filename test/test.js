const test = require('ava');

const Script = require('..');

test.beforeEach(t => {
  const script = new Script({});
  Object.assign(t.context, { script });
});

test('returns itself', t => {
  t.true(t.context.script instanceof Script);
});

test('sets a config object', t => {
  const script = new Script(false);
  t.true(script instanceof Script);
});

test('renders name', t => {
  const { script } = t.context;
  t.is(script.renderName(), 'script');
});

test('sets a default name', t => {
  const { script } = t.context;
  t.is(script._name, 'script');
});
