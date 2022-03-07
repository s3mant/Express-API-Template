const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const { sync } = require("glob");
const { parse, resolve } = require("path");
const list = [];

let routes = sync(resolve("./routes/**/*.js"));

port = 7000;

exports.load = function (app) {
  for (const directory of routes) {
    let route = require(directory);
    route.name = route.name ? route.name : parse(directory).name;
    route.category = route.category
      ? route.category
      : parse(directory).dir.split("/").pop();
    list.push(route);
    app.get(
      `/${route.category}/${route.name}`,
      rateLimit({
        windowMs: 10000,
        max: 100,
        message: "Rate Limit Exceeded"
      }),
      slowDown({
        windowMs: 15 * 60 * 1000,
        delayAfter: 100,
        delayMs: 500
      }),
      (...args) =>
        route.execute(...args).catch((e) => {
          console.log(e);
          res.send({ error: "internal server error" });
        })
    );
  }
  console.log(`${routes.length} Routes Loaded`);
  app.listen(port, () => {
    console.log(`API is ready on port ${port}`);
  });
};
exports.routes = list;
