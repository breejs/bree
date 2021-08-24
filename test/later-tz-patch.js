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
      name: 'RangeError',
      message: 'Invalid time zone specified: bogus_zone'
    }
  );
});

test('.setTimeout() adjusts scheduled time if the local timezone is ahead of the one specified', (t) => {
  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York
  const timezone = 'America/Mexico_City'; // time now = 2021-08-22T09:30:00.000-05:00
  const msHalfHour = 36e5 / 2;

  // Run half hour later.
  // Intended datetime: 2021-08-22T10:00:00.000-05:00
  // But instead, we don't specify timezone here
  const intendedDatetime = '2021-08-22T10:00:00.000';
  // And so, `new Date()` will use it's local timezone:
  // Assumed datetime: 2021-08-22T10:00:00.000-05:00
  const assumedTimezone = '-04:00';
  const s = later.parse
    .recur()
    .on(new Date(intendedDatetime + assumedTimezone))
    .fullDate();

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  // hijack `setTimeout()` to test `timeout` param
  const setTimeout_og = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    // Time now: 2021-08-22T09:30:00.000-05:00
    // Intended run time: 2021-08-22T10:00:00.000-05:00
    t.is(ms, msHalfHour);
  };

  later.setTimeout(noop, s, timezone);

  // reset
  global.setTimeout = setTimeout_og;
  clock.uninstall();
});

test('.setTimeout() adjusts scheduled time if the local timezone is behind of the one specified', (t) => {
  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York
  const timezone = 'Europe/Athens'; // time now = 2021-08-22T17:30:00.000+03:00
  const msHalfHour = 36e5 / 2;

  // Run half hour later.
  // Intended datetime: 2021-08-22T18:00:00.000-05:00
  // But instead, we don't specify timezone here
  const intendedDatetime = '2021-08-22T18:00:00.000';
  // And so, `new Date()` will use it's local timezone:
  // Assumed datetime: 2021-08-22T18:00:00.000-05:00
  const assumedTimezone = '-04:00';
  const s = later.parse
    .recur()
    .on(new Date(intendedDatetime + assumedTimezone))
    .fullDate();

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  // hijack `setTimeout()` to test `timeout` param
  const setTimeout_og = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    // Time now: 2021-08-22T09:30:00.000-05:00
    // Intended run time: 2021-08-22T10:00:00.000-05:00
    t.is(ms, msHalfHour);
  };

  later.setTimeout(noop, s, timezone);

  // reset
  global.setTimeout = setTimeout_og;
  clock.uninstall();
});

test('.setTimeout() does not adjust time if specified and local timezones are the same', (t) => {
  const datetimeNow = new Date('2021-08-22T10:30:00.000-04:00'); // zone = America/New_York
  const timezone = 'America/New_York';
  const msOneHour = 36e5;

  // Intended run time is one hour later: 2021-08-22 at 11:30, New York time
  const intendedRunTime = '2021-08-22T11:30:00.000-04:00';

  const s = later.parse.recur().on(new Date(intendedRunTime)).fullDate();

  const clock = FakeTimers.install({
    now: datetimeNow.getTime()
  });

  // hijack `setTimeout()` to test `timeout` param
  const setTimeout_og = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    // intended time
    // America/Mexico_City => 2021-08-22T11:30:00.000-05:00
    // America/New_York => 2021-08-22T12:30:00.000-04:00
    //
    t.is(ms, msOneHour);
  };

  later.setTimeout(noop, s, timezone);

  // reset
  global.setTimeout = setTimeout_og;
  clock.uninstall();
});
