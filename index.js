let app = require("./structures");

app.get("/", (req, res) => {
  res.render("index", { routes: app.routes });
});
