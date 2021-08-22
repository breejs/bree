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

      const offsetHours = (date
        .toLocaleString('ia', { timeZone: timezone, timeZoneName: 'short' })
        .match(/[+-]\d+$/) || ['0'])[0];
      const offsetMillis = Number(offsetHours) * 60 * 6e4;
      const adjustedNow = new Date(now + offsetMillis);

      return s.next(2, adjustedNow).map((time) => {
        const schedMillis = new Date(time).getTime();
        const adjustedMillis = schedMillis + offsetMillis;
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
