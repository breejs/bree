const later = require('@breejs/later');

later.setTimeout = (fn, sched, timezone) => {
  const s = later.schedule(sched);
  let t;
  if (fn) {
    scheduleTimeout();
  }

  function scheduleTimeout() {
    const date = new Date();
    const now = date.getTime();

    const next = (() => {
      if (!timezone || ['local', 'system'].includes(timezone)) {
        return s.next(2, now);
      }

      // Get specified timezone's UTC offset
      const offsetTime = date
        .toLocaleString('ia', { timeZone: timezone, timeZoneName: 'short' })
        .match(/([+-])(\d+):?(\d*)$/) || ['0'];
      // convert time to milliseconds and negate
      // for convenience ie. +5:30 => -19800000
      const offsetMillis = -Number(
        offsetTime[1] +
          (Number(offsetTime[2]) * 36e5 + Number(offsetTime[3]) * 6e4)
      );

      // The number of minutes returned by getTimezoneOffset() is positive if the local
      // time zone is behind UTC, and negative if the local time zone is ahead of UTC.
      // Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset#negative_values_and_positive_values
      const localOffsetMillis = date.getTimezoneOffset() * 6e4;

      // Specified timezone has the same offset as local timezone.
      // ie. datetime = 2021-08-22T11:30:00.000-04:00 => America/Nassau
      //     zone     = America/New_York => 2021-08-22T11:30:00.000-04:00
      if (offsetMillis === localOffsetMillis) {
        return s.next(2, now);
      }

      // Offsets differ, adjust current time to match what
      // it should've been for the specified timezone.
      const adjustedNow = new Date(now + localOffsetMillis - offsetMillis);
      return (s.next(2, adjustedNow) || []).map((time) => {
        // adjust scheduled times to match their intended timezone
        // ie. scheduled = 2021-08-22T11:30:00.000-04:00 => America/New_York
        //     intended  = 2021-08-22T11:30:00.000-05:00 => America/Mexico_City
        const schedMillis = time.getTime();
        const adjustedMillis = schedMillis + offsetMillis - localOffsetMillis;
        return new Date(adjustedMillis);
      });
    })();

    if (!next[0]) {
      t = undefined;
      return;
    }

    let diff = next[0].getTime() - now;
    if (diff < 1e3) {
      diff = next[1] ? next[1].getTime() - now : 1e3;
    }

    t =
      diff < 2147483647
        ? setTimeout(fn, diff)
        : setTimeout(scheduleTimeout, 2147483647);
  } // scheduleTimeout()

  return {
    isDone() {
      return !t;
    },
    clear() {
      clearTimeout(t);
    }
  };
}; // setTimeout()

later.setInterval = function (fn, sched, timezone) {
  if (!fn) {
    return;
  }

  let t = later.setTimeout(scheduleTimeout, sched, timezone);
  let done = t.isDone();
  function scheduleTimeout() {
    if (!done) {
      fn();
      t = later.setTimeout(scheduleTimeout, sched, timezone);
    }
  }

  return {
    isDone() {
      return t.isDone();
    },
    clear() {
      done = true;
      t.clear();
    }
  };
}; // setInterval()

module.exports = later;
