// server.js
// where your node app starts

// we've started you off with Express (https://expressjs.com/)
// but feel free to use whatever libraries or frameworks you'd like through `package.json`.
const express = require("express");
const app = express();

var randomize = require("randomatic");
var session = require("express-session");

const fs = require("fs");

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(require("express-status-monitor")());

const cors = require("cors");
app.use(cors());
const config = require("./config");
const bcrypt = require("bcrypt");
const path = require("path");

var mkdirp = require("mkdirp");
var rimraf = require("rimraf");

const endb = require("endb");
var user = new endb("sqlite://user.db");
var project = new endb("sqlite://project.db");

async function all() {
  let users = await user.all();
  let projects = await project.all();
  console.log(users);
  console.log(projects);
}

async function clear() {
  let users = await user.clear();
  let projects = await project.clear();
}

// clear();
// all();

app.use(express.static("public"));
app.set("views", path.join(__dirname, "ejs"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true
  })
);

function checkHttps(req, res, next) {
  // protocol check, if http, redirect to https

  if (req.get("X-Forwarded-Proto").indexOf("https") != -1) {
    console.log("https, yo");
    return next();
  } else {
    console.log("just http");
    res.redirect("https://" + req.hostname + req.url);
  }
}

app.all("*", checkHttps);

app.get("/", async (request, response) => {
  if (request.session.loggedin) {
    response.redirect("/u/" + request.session.username);
  } else {
    response.sendFile(__dirname + "/views/login.html");
  }
});

app.get("/login", (request, response) => {
  response.sendFile(__dirname + "/views/login.html");
});

app.get("/signup", async (request, response) => {
  response.sendFile(__dirname + "/views/signup.html");
});

app.post("/signup", async (request, response) => {
  var authdata;
  global.email = request.body.email;
  var username = request.body.username;
  var password = request.body.password;
  if (username && password && global.email) {
    let hasuser = await user.has(username);
    if (!hasuser) {
      bcrypt.hash(password, config.saltRounds, async function(err, hash) {
        let userinfo = { password: hash, email: global.email };
        let newuser = await user.set(username, userinfo);
        authdata = { redirect: "/", detail: "newuser" };
        response.send(authdata);
      });
    } else {
    }
  }
});

app.post("/auth", async function(request, response) {
  var authdata;
  global.username = request.body.username;
  global.password = request.body.password;
  if (global.username && global.password) {
    let hasuser = await user.has(global.username);
    console.log("Has user" + hasuser)
    if (hasuser) {
      let pass = await user.get(global.username);
      console.log(pass.projects);
      pass = pass.password;
      //console.log(pass);
      //console.log(global.password);
      // Don't log passwords into the log
      bcrypt.compare(global.password, pass, function(err, result) {
        console.log("Login correct "+result+" "+err)
    if(result){
      
        request.session.loggedin = true;
        request.session.username = global.username;
        global.theuser = request.session.username;
        authdata = {
          redirect: "editor",
          detail: "loggedin",
          user: global.username
        };
        response.send(authdata);
        // response.redirect("/editor");
      } else {
        // response.send("Incorrect Username and/or Password!");
        authdata = { redirect: "/", detail: "wronginfo" };
        response.send(authdata);
      }
        response.end();
});
      
    } else {
      // esponse.redirect('/signup');
      authdata = { redirect: "signup", detail: "noaccount" };
      response.send(authdata);
    }
  }
});

  

app.get("/editor/new", async (req, res) => {
  if (req.session.loggedin) {
    let projectname = randomize("Aa0", 10); // Fallback
    if(config.nameGen == "sensible"){
      const { uniqueNamesGenerator, adjectives, colors, animals } = require('unique-names-generator');
      projectname = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });
    }else if(config.nameGen == "sensible2"){
      var generate = require('project-name-generator');
      projectname = generate({ words: 4 }).dashed;
    }else if(config.nameGen == "alliterative"){
      var generate = require('project-name-generator');
      projectname = generate({ words: 4,alliterative: true}).dashed;
    }
    
    let dir = __dirname + "/projects/";
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
    } catch (err) {
      console.error(err);
    }

    mkdirp.sync(`projects/${projectname}`);

    // let data = { name: name };
    fs.writeFile(
      __dirname + `/projects/${projectname}/index.html`,
      "",
      function(err) {
        if (err) throw err;
      }
    );
    fs.writeFile(__dirname + `/projects/${projectname}/style.css`, "", function(
      err
    ) {
      if (err) throw err;
    });
    fs.writeFile(__dirname + `/projects/${projectname}/script.js`, "", function(
      err
    ) {
      if (err) throw err;
    });
    let projectinfo = { name: projectname, owner: global.theuser };
    let setinfo = await project.set(projectname, projectinfo);
    res.redirect(`/editor/${projectname}`);
  } else {
    res.redirect("/");
  }
});

app.get("/editor/:project", function(request, response) {
  if (
    request.session.username === global.theuser &&
    request.session.loggedin === true
  ) {
    response.sendFile(__dirname + "/views/editor.html");
    console.log(global.theuser);
  } else {
    response.sendFile(__dirname + "/views/preview.html");
  }
});

// app.get("/edit/:project", async function(request, response) {
//   let hasproject = await project.has(request.params.project);
//   if (!hasproject) {
//     response.redirect("/editor");
//   } else {
//     let projectinfo = await project.get(request.params.project);
//     let owner = projectinfo.owner;
//     if (request.session.username === owner) {

//     }
//   }
// });

app.post("/deploy", async function(request, response) {
  let projectname = request.body.name;
  let filename = request.body.name + ".html";
  fs.writeFile(
    "projects/" + projectname + "/index.html",
    request.body.code,
    function(err) {
      if (err) throw err;
    }
  );
  fs.writeFile(
    "projects/" + projectname + "/style.css",
    request.body.css,
    function(err) {
      if (err) throw err;
    }
  );
  fs.writeFile(
    "projects/" + projectname + "/script.js",
    request.body.js,
    function(err) {
      if (err) throw err;
    }
  );
  let projectinfo = { name: projectname, owner: global.theuser };
  let setinfo = await project.set(projectname, projectinfo);
  response.send({ status: 200 });
});

app.get("/getCode/:projectname", async (req, res) => {
  let projectname = req.params.projectname;
  // fs.readFile(`projects/${projectname}/index.html`, "utf8", function(err, data) {
  //   res.send({ code: data });
  // });
  let code = fs.readFileSync(`projects/${projectname}/index.html`, "utf-8");
  let css = fs.readFileSync(`projects/${projectname}/style.css`, "utf-8");
  let js = fs.readFileSync(`projects/${projectname}/script.js`, "utf-8");
  res.send({ code: code, css: css, js: js });
});

app.get("/p/:project", function(req, res) {
  let projectname = req.params.project;
  res.sendFile(__dirname + "/projects/" + projectname + "/index.html");
});

app.get("/p/:project/style.css", function(req, res) {
  let projectname = req.params.project;
  res.sendFile(__dirname + "/projects/" + projectname + "/style.css");
});

app.get("/p/:project/script.js", function(req, res) {
  let projectname = req.params.project;
  res.sendFile(__dirname + "/projects/" + projectname + "/script.js");
});

app.get("/redirect/loginfail", function(req, res) {
  res.sendFile(__dirname + "/views/login-fail.html");
});

app.get("/delete/:project", async (req, res) => {
  let projectinfo = await project.get(req.params.project);
  if (req.session.loggedin && req.session.username === projectinfo.owner) {
    await project.delete(req.params.project);
    rimraf.sync(`/projects/{req.params.project}`);
    console.log("Authorised!");
    res.sendStatus(200);
  } else {
    console.log("Unauthorised!");
    res.sendStatus(401);
  }
});

app.get("/u/:user", async (req, res) => {
  if (!(await user.has(req.params.user))) {
    res.send("User not found!");
    return;
  }
  console.log("User info...");
  var projects = await project.all();
  projects = projects.filter(
    project => project.value.owner === req.params.user
  );
  console.log(projects);
  if (req.session.loggedin && req.session.username === req.params.user) {
    console.log("Logged in!");
    res.render("user", {
      projects: projects,
      username: req.params.user,
      user: req.session.username
    });
  } else {
    console.log("Not logged in!");
    res.render("userpreview", {
      projects: projects,
      username: req.params.user,
      user: "not logged in!"
    });
  }
});

app.get("/me", (req, res) => {
  let me = req.session.username;
  res.redirect(`/u/${me}`);
});

app.get("/projectinfo/:projectname", async (req, res) => {
  let projectname = req.params.projectname;
  let projectinfo = await project.get(projectname);
  console.log(projectname);
  console.log(projectinfo);
  res.send({ name: projectinfo.name, owner: projectinfo.owner });
});

app.get("/login-new", (req, res) => {
  res.sendFile(__dirname + "/views/login-new.html");
});

app.get("/logout", (req, res) => {
  req.session.loggedin = false;
  req.session.destroy(function(err) {
    if (err) throw err;
    res.redirect("/");
  });
});
// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
