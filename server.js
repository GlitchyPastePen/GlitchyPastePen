// Imports
const express = require("express");
const app = express();
const http = require("http");
const io = require("socket.io");
const server = http.createServer(app);
const socket = io.listen(server);
const Endb = require("endb");
const randomize = require("randomatic");
const session = require("express-session");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const { join } = require('path');

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(require("express-status-monitor")());
app.use(cors());
app.use(express.static("public"));
app.use("/modules", express.static("node_modules"));
app.use(
  session({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true
  })
);

app.set("views", join(__dirname, "ejs"));
app.set("view engine", "ejs");

// Database
var user = new Endb("sqlite://user.db");
var project = new Endb("sqlite://project.db");
var contributor = new Endb("sqlite://contributor.db");

// Listener
server.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + process.env.PORT);
});

socket.on("connection", socket => {
  console.log("connected!");
});

module.exports = { app, user, project };