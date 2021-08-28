const test = require('ava');
const FakeTimers = require('@sinonjs/fake-timers');

const later = require('../src/later-tz-patch');

const noop = () => {
  /* noop */
};

test('.setTimeout() accepts IANA timezone strings', (t) => {
  t.notThrows(() => {
    const s = later.parse.recur().every(2).second();
    later.setTimeout(() => t.pass(), s, 'America/New_York');
  });
});

test('.setTimeout() accepts "local" and "system" as valid timezone strings', (t) => {
  t.notThrows(() => {
    const s = later.parse.recur().every(2).second();
    later.setTimeout(() => t.pass(), s, 'local');
    later.setTimeout(() => t.pass(), s, 'system');
  });
});

test('.setTimeout() throws RangeError when given an invalid or unsupported timezone string', (t) => {
  t.throws(
    () => {
      const s = later.parse.recur().every(2).second();
      later.setTimeout(() => t.pass(), s, 'bogus_zone');
    },
    {
      name: 'RangeError'
    }
  );
});

test.serial(
  '.setTimeout() adjusts scheduled time if the local timezone is ahead of the one specified',
  (t) => {
    t.plan(1);

    const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York
    const timezone = 'America/Mexico_City'; // time now = 2021-08-22T09:30:00.000-05:00
    const msHalfHour = 18e5;

    // Run half hour later.
    // Intended datetime: 2021-08-22T10:00:00.000-05:00
    // But instead, we don't specify timezone here
    const intendedDatetime = '2021-08-22T10:00:00.000';
    // And so, `new Date()` will use it's local timezone:
    // Assumed datetime: 2021-08-22T10:00:00.000-04:00
    const assumedTimezone = '-04:00';
    const s = later.parse
      .recur()
      .on(new Date(intendedDatetime + assumedTimezone))
      .fullDate();

    const clock = FakeTimers.install({
      now: datetimeNow.getTime()
    });
    clock.Date.prototype.getTimezoneOffset = () => 240;

    clock.setTimeout = (fn, ms) => {
      t.is(ms, msHalfHour);
    };

    later.setTimeout(noop, s, timezone);

    clock.uninstall();
  }
);

test.serial(
  '.setTimeout() adjusts scheduled time if the local timezone is behind of the one specified',
  (t) => {
    t.plan(1);

    const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York
    const timezone = 'Europe/Athens'; // time now = 2021-08-22T17:30:00.000+03:00
    const msHalfHour = 18e5;

    // Run half hour later.
    // Intended datetime: 2021-08-22T18:00:00.000+03:00
    // But instead, we don't specify timezone here
    const intendedDatetime = '2021-08-22T18:00:00.000';
    // And so, `new Date()` will use it's local timezone:
    // Assumed datetime: 2021-08-22T18:00:00.000-04:00
    const assumedTimezone = '-04:00';
    const s = later.parse
      .recur()
      .on(new Date(intendedDatetime + assumedTimezone))
      .fullDate();

    const clock = FakeTimers.install({
      now: datetimeNow.getTime()
    });
    clock.Date.prototype.getTimezoneOffset = () => 240;

    clock.setTimeout = (fn, ms) => {
      t.is(ms, msHalfHour);
    };

    later.setTimeout(noop, s, timezone);

    clock.uninstall();
  }
);

test.serial(
  '.setTimeout() does not adjust time if specified and local timezones are the same',
  (t) => {
    t.plan(1);

    const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York
    const timezone = 'America/New_York';
    const msOneHour = 36e5;

    // Intended run time is one hour later: 2021-08-22 at 11:30, New York time
    const intendedRunTime = '2021-08-22T11:30:00.000-04:00';

    const s = later.parse.recur().on(new Date(intendedRunTime)).fullDate();

    const clock = FakeTimers.install({
      now: datetimeNow.getTime()
    });
    clock.Date.prototype.getTimezoneOffset = () => 240;

    clock.setTimeout = (fn, ms) => {
      t.is(ms, msOneHour);
    };

    later.setTimeout(noop, s, timezone);

    clock.uninstall();
  }
);

test.serial(
  '.setTimeout() should not execute a far out schedule immediately',
  (t) => {
    t.plan(3);

    const s = later.parse.recur().on(2017).year();
    const clock = FakeTimers.install({ now: Date.now() });
    clock.setTimeout = () => t.true(false);

    const timeout = later.setTimeout(noop, s);

    t.not(timeout.isDone, undefined);
    t.not(timeout.clear, undefined);
    t.is(timeout.isDone(), true);

    clock.uninstall();
  }
);

test.serial('.setTimeout() minimum time to fire is one second', (t) => {
  t.plan(4);

  const now = new Date('2021-08-22T10:30:00.000-04:00').getTime();
  const s = later.parse
    .recur()
    .on(new Date(now + 250))
    .fullDate();

  const clock = FakeTimers.install({ now });
  clock.setTimeout = (fn, ms) => t.is(ms, 1000);

  const timeout = later.setTimeout(noop, s);

  t.not(timeout.isDone, undefined);
  t.not(timeout.clear, undefined);
  t.is(timeout.isDone(), true);

  clock.uninstall();
});

test.serial('.setTimeout() should reschedule if more than ~24days', (t) => {
  t.plan(5);

  const now = new Date('2021-08-22T10:30:00.000-04:00').getTime();
  const s = later.parse
    .recur()
    .on(new Date(now + 36e5 * 24 * 30))
    .fullDate();

  const clock = FakeTimers.install({ now });
  clock.setTimeout = (fn, ms) => {
    t.is(ms, 2147483647);
    t.is(fn.name, 'scheduleTimeout');
  };

  const timeout = later.setTimeout(noop, s);

  t.not(timeout.isDone, undefined);
  t.not(timeout.clear, undefined);
  t.is(timeout.isDone(), true);

  clock.uninstall();
});

test('.setTimeout() should not throw if no callback is specified', (t) => {
  t.plan(1);

  const s = later.parse.recur().on(2017).year();
  t.notThrows(() => later.setTimeout(undefined, s));
});

test('.setInterval() should not throw if no callback is specified', (t) => {
  t.plan(1);

  t.notThrows(() => later.setInterval(undefined));
});

test.serial('.setInterval() should not execute an older schedule', (t) => {
  t.plan(3);

  const s = later.parse.recur().on(2017).year();
  const clock = FakeTimers.install({ now: Date.now() });
  clock.setTimeout = () => t.true(false);
  const interval = later.setInterval(noop, s);

  t.not(interval.isDone, undefined);
  t.not(interval.clear, undefined);
  t.is(interval.isDone(), true);

  clock.uninstall();
});
