// Imports
const express = require("express");
const app = express();
const Endb = require("endb");
const randomize = require("randomatic");
const session = require("express-session");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const mkdirp = require("mkdirp");
const rimraf = require("rimraf");
const generate = require("project-name-generator");
const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals
} = require("unique-names-generator");
const config = require("./config");

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(require("express-status-monitor")());
app.use(cors());
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true
  })
);

app.set("views", path.join(__dirname, "ejs"));
app.set("view engine", "ejs");

// Database
var user = new Endb("sqlite://user.db");
var project = new Endb("sqlite://project.db");
var contributor = new Endb("sqlite://contributor.db")

async function all() {
  console.log(await user.all());
  console.log(await project.all());
}

async function clear() {
  await user.clear();
  await project.clear();
  return undefined;
}

app.all("*", (request, response, next) => {
  // protocol check, if http, redirect to https
  if (request.get("X-Forwarded-Proto").indexOf("https") != -1) {
    return next();
  } else {
    response.redirect("https://" + request.hostname + request.url);
  }
});

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
  let authdata;
  global.email = request.body.email;
  const username = request.body.username;
  const password = request.body.password;
  if (username && password && global.email) {
    const hasuser = await user.has(username);
    if (!hasuser) {
      bcrypt.hash(password, config.saltRounds, async function(err, hash) {
        const userinfo = { password: hash, email: global.email };
        const newuser = await user.set(username, userinfo);
        authdata = { redirect: "/", detail: "newuser" };
        response.send(authdata);
      });
    }
  }
});

app.post("/auth", async function(request, response) {
  let authdata;
  global.username = request.body.username;
  global.password = request.body.password;
  if (global.username && global.password) {
    const hasuser = await user.has(global.username);
    console.log("Has user" + hasuser);
    if (hasuser) {
      const pass = await user.get(global.username, "password");
      bcrypt.compare(global.password, pass, (error, result) => {
        if (result) {
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
      // response.redirect('/signup');
      authdata = { redirect: "signup", detail: "noaccount" };
      response.send(authdata);
    }
  }
});

app.get("/editor/new", async (req, res) => {
  if (req.session.loggedin) {
    let projectname = randomize("Aa0", 10);
    if (config.nameGen == "sensible") {
      projectname = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals]
      });
    } else if (config.nameGen == "sensible2") {
      projectname = generate({ words: 4 }).dashed;
    } else if (config.nameGen == "alliterative") {
      projectname = generate({ words: 4, alliterative: true }).dashed;
    }

    const dir = __dirname + "/projects/";
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
      error => {
        if (error) throw error;
      }
    );
    fs.writeFile(
      __dirname + `/projects/${projectname}/style.css`,
      "",
      error => {
        if (error) throw error;
      }
    );
    fs.writeFile(
      __dirname + `/projects/${projectname}/script.js`,
      "",
      error => {
        if (error) throw error;
      }
    );
    const projectInfo = { name: projectname, owner: global.theuser };
    await project.set(projectname, projectInfo);
    res.redirect(`/editor/${projectname}`);
  } else {
    res.redirect("/");
  }
});

app.get("/editor/:project/", async (request, response) => {
  let contributors = await contributor.get(request.params.project);
  if (
    (request.session.username === global.theuser &&
    request.session.loggedin === true) || (contributors.includes(request.session.username)) 
  ) {
    console.log(request.query.togetherjs);
    response.sendFile(__dirname + "/views/editor.html");
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
  const projectinfo = await project.get(request.body.name);
  if (
    request.session.username === projectinfo.owner &&
    request.session.loggedin === true
  ) {
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
  } else {
    response.sendStatus(401);
  }
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
  const project = await project.get(req.params.project);
  if (req.session.loggedin && req.session.username === project.owner) {
    await project.delete(req.params.project);
    rimraf.sync(`/projects/{req.params.project}`);
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

app.post("/contributor", async (req, res) => {
  const user = req.body.user;
  console.log(req.body.project)
  console.log(await project.get(req.body.project));
  const project2 = await project.get(req.body.project);
  if (req.session.username === project2.owner && req.session.loggedin) {
    let current = await contributor.get(req.body.project) || [];
    current.push(user);
    await contributor.set(req.body.project, current);
    res.send("200");
  } else {
    res.send("401");
  }
})

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
  } else if (req.session.username === 'khalby786') {
    res.render("user", {
      projects: projects,
      username: req.params.user,
      user: req.session.username,
      // users: await 
    });
  } else {
    res.render("userpreview", {
      projects: projects,
      username: req.params.user,
      user: "not logged in!"
    });
  }
});

app.get("/me", (req, res) => {
  const username = req.session.username;
  res.redirect(`/u/${username}`);
});

app.get("/projectinfo/:projectname", async (req, res) => {
  const projectName = req.params.projectname;
  const projectinfo = await project.get(projectName);
  res.send({ name: projectinfo.name, owner: projectinfo.owner });
});

app.get("/login-new", (req, res) => {
  res.sendFile(__dirname + "/views/login-new.html");
});

app.get("/logout", (req, res) => {
  req.session.loggedin = false;
  req.session.destroy(error => {
    if (error) throw error;
    res.redirect("/");
  });
});

// Listener
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
