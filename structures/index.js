const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const handler = require("./handler");
const { resolve } = require("path");

app.routes = handler.routes;

app.set("view engine", "ejs").use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(resolve("./public")));
handler.load(app);
module.exports = app;
