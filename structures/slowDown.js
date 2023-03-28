function calculateNextResetTime(windowMs) {
  const d = new Date();
  d.setMilliseconds(d.getMilliseconds() + windowMs);
  return d;
}
function MemoryStore(windowMs) {
  let hits = {};
  let resetTime = calculateNextResetTime(windowMs);
  this.incr = function (key, cb) {
    if (hits[key]) {
      hits[key]++;
    } else {
      hits[key] = 1;
    }
    cb(null, hits[key], resetTime);
  };
  this.decrement = function (key) {
    if (hits[key]) {
      hits[key]--;
    }
  };
  this.resetAll = function () {
    hits = {};
    resetTime = calculateNextResetTime(windowMs);
  };
  this.resetKey = function (key) {
    delete hits[key];
    delete resetTime[key];
  };
  const interval = setInterval(this.resetAll, windowMs);
  if (interval.unref) {
    interval.unref();
  }
}
function SlowDown(opts) {
  const options = {
    windowMs: 60 * 1000,
    delayAfter: 1,
    delayMs: 1000,
    maxDelayMs: Infinity,
    skipFailedRequests: !1,
    skipSuccessfulRequests: !1,
    headers: !1,
    keyGenerator: function (req) {
      return req.ip;
    },
    skip: function () {
      return !1;
    },
    onLimitReached: function () {},
    ...opts,
  };
  options.store = options.store || new MemoryStore(options.windowMs);
  if (
    (typeof options.store.incr !== "function" &&
      typeof options.store.increment !== "function") ||
    typeof options.store.resetKey !== "function" ||
    (options.skipFailedRequests &&
      typeof options.store.decrement !== "function")
  ) {
    throw new Error("The store is not valid.");
  }
  function slowDown(req, res, next) {
    if (options.skip(req, res)) {
      return next();
    }
    const key = options.keyGenerator(req, res);
    const handleIncrement = (current, resetTime) => {
      let delay = 0;
      const delayAfter =
        typeof options.delayAfter === "function"
          ? options.delayAfter(req, res)
          : options.delayAfter;
      const delayMs =
        typeof options.delayMs === "function"
          ? options.delayMs(req, res)
          : options.delayMs;
      const maxDelayMs =
        typeof options.maxDelayMs === "function"
          ? options.maxDelayMs(req, res)
          : options.maxDelayMs;
      if (current > delayAfter) {
        const unboundedDelay = (current - delayAfter) * delayMs;
        delay = Math.min(unboundedDelay, maxDelayMs);
      }
      req.slowDown = {
        limit: delayAfter,
        current: current,
        remaining: Math.max(delayAfter - current, 0),
        resetTime: resetTime,
        delay: delay,
      };
      if (options.headers && !res.headersSent) {
        res.setHeader("X-SlowDown-Limit", req.slowDown.limit);
        res.setHeader("X-SlowDown-Remaining", req.slowDown.remaining);
        if (resetTime instanceof Date) {
          res.setHeader("Date", new Date().toGMTString());
          res.setHeader(
            "X-SlowDown-Reset",
            Math.ceil(resetTime.getTime() / 1000)
          );
        }
      }
      if (current - 1 === delayAfter) {
        options.onLimitReached(req, res, options);
      }
      if (options.skipFailedRequests || options.skipSuccessfulRequests) {
        let decremented = !1;
        const decrementKey = () => {
          if (!decremented) {
            options.store.decrement(key);
            decremented = !0;
          }
        };
        if (options.skipFailedRequests) {
          res.on("finish", function () {
            if (res.statusCode >= 400) {
              decrementKey();
            }
          });
          res.on("close", () => {
            if (!res.finished) {
              decrementKey();
            }
          });
          res.on("error", decrementKey);
        }
        if (options.skipSuccessfulRequests) {
          res.on("finish", function () {
            if (res.statusCode < 400) {
              options.store.decrement(key);
            }
          });
        }
      }
      if (delay !== 0) {
        const timerId = setTimeout(next, delay);
        res.on("close", () => {
          clearTimeout(timerId);
        });
        return timerId;
      }
      next();
    };
    if (typeof options.store.increment !== "undefined") {
      return options.store
        .increment(key)
        .then(({ totalHits, resetTime }) =>
          handleIncrement(totalHits, resetTime)
        )
        .catch((err) => next(err));
    } else {
      options.store.incr(key, (err, current, resetTime) => {
        if (err) {
          next(err);
        } else {
          handleIncrement(current, resetTime);
        }
      });
    }
  }
  slowDown.resetKey = options.store.resetKey.bind(options.store);
  return slowDown;
}
module.exports = SlowDown;
