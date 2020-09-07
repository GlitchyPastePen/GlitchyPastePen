const bcrypt = require("bcrypt");
const mkdirp = require("mkdirp");
const rimraf = require("rimraf");
const generate = require("project-name-generator");
const randomize = require("randomatic");
const fetch = require('node-fetch');
const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals
} = require("unique-names-generator");
const { Octokit } = require("@octokit/core");
const octokit = new Octokit({ auth: process.env.GITHUB_ACCESS_TOKEN });
const config = require("./config");
const Endb = require("endb");
var contributor = new Endb("sqlite://contributor.db");

// Endpoints
module.exports.run = ({ app, user, project } = {}) => {
  const clientID = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  app.all("*", (request, response, next) => {
    // protocol check, if http, redirect to https
    if (request.get("X-Forwarded-Proto").indexOf("https") != -1) {
      return next();
    } else {
      response.redirect("https://" + request.hostname + request.url);
    }
  });

  app.get("/login/github", (req, res) => {
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${process.env.CLIENT_ID}`
    );
  });

  async function getAccessToken(code, client_id, client_secret) {
    const request = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code
      })
    });
    const text = await request.text();
    console.log("RESPONSE!!!");
    console.log(text);
    const params = new URLSearchParams(text);
    return params.get("access_token");
  }

  async function fetchGitHubUser(token) {
    const request = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: "token " + token
      }
    });
    return await request.json();
  }

  app.get("/login/github/callback", async (req, res) => {
    const code = req.query.code;
    const access_token = await getAccessToken(code, clientID, clientSecret);
    console.log(access_token);
    const login_user = await fetchGitHubUser(access_token);
    if (login_user) {
      req.session.access_token = access_token;
      req.session.github = login_user;
      req.session.githubId = login_user.id;
      req.session.username = req.session.github.login;
      if (req.session.username == "Assfugil") {
        console.error(">> Assfugil has attempted to log in!");
        res.send("You have been banned!");
        return;
      }
      req.session.email = req.session.github.email;
      req.session.loggedin = true;
      console.error(">> " + req.session.username + " has logged in!")
      await user.set(req.session.username, { 
        name: req.session.username, 
        email: req.session.email,
        id: req.session.github.id,
        created_at: req.session.github.created_at,
        updated_at: req.session.github.updated_at,
        project_count: 0
      });
      console.log({ 
        name: req.session.username, 
        email: req.session.email,
        id: req.session.github.id,
        created_at: req.session.github.created_at,
        updated_at: req.session.github.updated_at
      });
      res.redirect("/me");
    } else {
      res.send("Login did not succeed!");
    }
  });

  app.get("/", async (request, response) => {
    if (request.session.loggedin) {
      response.redirect("/u/" + request.session.username);
    } else {
      response.sendFile(__dirname + "/views/login.html");
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
      
      let html = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'khalby786',
        repo: 'GlitchyPastePen_ProjectFiles',
        path: projectname + "/index.html",
        message: 'index.html file created for ' + projectname + " by " + req.session.username,
        content: ''
      });
      
      let css = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'khalby786',
        repo: 'GlitchyPastePen_ProjectFiles',
        path: projectname + "/style.css",
        message: 'style.css file created for ' + projectname + " by " + req.session.username,
        content: ''
      });
      
      let js = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'khalby786',
        repo: 'GlitchyPastePen_ProjectFiles',
        path: projectname + "/script.js",
        message: 'script.js file created for ' + projectname + " by " + req.session.username,
        content: ''
      });
      
      console.log(html.data.content);
      
      const projectInfo = { 
        name: projectname, 
        owner: req.session.username,
        html_sha: html.data.content.sha,
        css_sha: css.data.content.sha,
        js_sha: js.data.content.sha
      };
      
      let userinfo = await user.get(req.session.username);
      userinfo.project_count++;
      await user.set(req.session.username, userinfo);
      console.error(">> New project " + projectname + " has been created by " + req.session.username);
      await project.set(projectname, projectInfo);
      res.redirect(`/editor/${projectname}`);
    } else {
      res.redirect("/");
    }
  });


  app.get("/editor/:project/", async (request, response) => {
    let contributors = await contributor.get(request.params.project);
    const projectinfo = await project.get(request.params.project);
    if (request.session.loggedin === true) {
      if ((request.session.username === projectinfo.owner) || contributors.includes(request.session.username)) {
        response.sendFile(__dirname + "/views/editor.html");
      }
    } else {
      response.sendFile(__dirname + "/views/preview.html");
    }
  });

  app.post("/deploy", async function(request, response) {
    const projectinfo = await project.get(request.body.name);
    if (
      request.session.username === projectinfo.owner &&
      request.session.loggedin === true
    ) {
      console.log("owner")
      let projectname = request.body.name;

      let projectinfo = await project.get(projectname);
      
      let html_buff = new Buffer(request.body.code);
      let html = html_buff.toString('base64');
      
      let css_buff = new Buffer(request.body.css);
      let css = css_buff.toString('base64');
      
      let js_buff = new Buffer(request.body.js);
      let js = js_buff.toString('base64');
      
      let html_update = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'khalby786',
        repo: 'GlitchyPastePen_ProjectFiles',
        path: projectname + "/index.html",
        message: 'index.html file updated for ' + projectname + " by " + request.session.username,
        content: html,
        sha: projectinfo.html_sha
      });
      
      let css_update = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'khalby786',
        repo: 'GlitchyPastePen_ProjectFiles',
        path: projectname + "/style.css",
        message: 'style.css file updated for ' + projectname + " by " + request.session.username,
        content: css,
        sha: projectinfo.css_sha
      });
      
      let js_update = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner: 'khalby786',
        repo: 'GlitchyPastePen_ProjectFiles',
        path: projectname + "/script.js",
        message: 'script.js file updated for ' + projectname + " by " + request.session.username,
        content: js,
        sha: projectinfo.js_sha
      });
      
      projectinfo.html_sha = html_update.data.content.sha;
      projectinfo.css_sha = css_update.data.content.sha;
      projectinfo.js_sha = js_update.data.content.sha;
      
      await project.set(projectname, projectinfo);
      
      response.send({ status: 200 });
    } else {
      response.sendStatus(401);
    }
  });

  app.get("/getCode/:projectname", async (req, res) => {
    let projectname = req.params.projectname;
    console.warn(`>> ${projectname} being actively edited!`);
    // fs.readFile(`projects/${projectname}/index.html`, "utf8", function(err, data) {
    //   res.send({ code: data });
    // });
    // let code = fs.readFileSync(`projects/${projectname}/index.html`, "utf-8");
    // let css = fs.readFileSync(`projects/${projectname}/style.css`, "utf-8");
    // let js = fs.readFileSync(`projects/${projectname}/script.js`, "utf-8");
    
    
    let html = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'khalby786',
      repo: 'GlitchyPastePen_ProjectFiles',
      path: req.params.projectname + "/index.html"
    });
        
    let buff = new Buffer(html.data.content, 'base64');
    let html_text = buff.toString('ascii');
    
    let css = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'khalby786',
      repo: 'GlitchyPastePen_ProjectFiles',
      path: req.params.projectname + "/style.css"
    });
        
    let css_buff = new Buffer(css.data.content, 'base64');
    let css_text = css_buff.toString('ascii');
    
    let js = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'khalby786',
      repo: 'GlitchyPastePen_ProjectFiles',
      path: req.params.projectname + "/script.js"
    });
        
    let js_buff = new Buffer(js.data.content, 'base64');
    let js_text = js_buff.toString('ascii');
    
    res.send({ code: html_text, css: css_text, js: js_text });
  });

  app.get("/p/:project", async function(req, res) {
    let projectname = req.params.project;
    
    let html = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'khalby786',
      repo: 'GlitchyPastePen_ProjectFiles',
      path: req.params.project + "/index.html"
    });
        
    let buff = new Buffer(html.data.content, 'base64');
    let text = buff.toString('ascii');
    
    res.send(text);
  });

  app.get("/p/:project/style.css", async function(req, res) {
    let projectname = req.params.project;
    let css = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'khalby786',
      repo: 'GlitchyPastePen_ProjectFiles',
      path: req.params.project + "/style.css"
    });
        
    let buff = new Buffer(css.data.content, 'base64');
    let text = buff.toString('ascii');
    
    res.send(text);
  });

  app.get("/p/:project/script.js", async function(req, res) {
    let projectname = req.params.project;
    
    let js = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner: 'khalby786',
      repo: 'GlitchyPastePen_ProjectFiles',
      path: req.params.project + "/script.js"
    });
        
    let buff = new Buffer(js.data.content, 'base64');
    let text = buff.toString('ascii');
    
    res.send(text);
  });

  app.get("/delete/:project", async (req, res) => {
    console.warn(">> " + req.params.project + " is scheduled for project deletion!");
    const project2 = await project.get(req.params.project);
    console.log(project2);
    if (req.session.loggedin && req.session.username === project2.owner) {
      try {
        await octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
          owner: 'khalby786',
          repo: 'GlitchyPastePen_ProjectFiles',
          path: project2.name + "/index.html",
          message: 'index.html file deleted for ' + project2.name + " by " + req.session.username,
          sha: project2.html_sha
        });
        
        await octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
          owner: 'khalby786',
          repo: 'GlitchyPastePen_ProjectFiles',
          path: project2.name + "/style.css",
          message: 'style.css file deleted for ' + project2.name + " by " + req.session.username,
          sha: project2.css_sha
        });
        
        await octokit.request('DELETE /repos/{owner}/{repo}/contents/{path}', {
          owner: 'khalby786',
          repo: 'GlitchyPastePen_ProjectFiles',
          path: project2.name + "/script.js",
          message: 'script.js file deleted for ' + project2.name + " by " + req.session.username,
          sha: project2.js_sha
        });
        
        await project.delete(req.params.project);
        res.sendStatus(200);
      } catch (err) {
        res.sendStatus(400);
      }
    } else {
      res.sendStatus(401);
    }
  });

  app.post("/contributor/:project/:user", async (req, res) => {
    const project2 = await project.get(req.params.project);
    if (req.session.username === project2.owner && req.session.loggedin) {
      let current = (await contributor.get(req.params.project)) || [];
      current.push(req.params.user);
      await contributor.set(req.params.project, current);
      res.send("200");
    } else {
      res.send("401");
    }
  });

  app.get("/u/:user", async (req, res) => {
    if (!(await user.has(req.params.user))) {
      res.send("User not found!");
      return;
    }
    var projects = await project.all();
    projects = projects.filter(
      project => project.value.owner === req.params.user
    );
    if (req.session.loggedin && (req.session.username === req.params.user)) {
      console.log({
        projects: projects,
        username: req.params.user,
        user: req.session.username,
        github: req.session.github
      })
      res.render("user", {
        projects: projects,
        username: req.params.user,
        user: req.session.username,
        github: req.session.github
      });
    } else if (req.session.loggedin === true && (req.session.username !== req.params.user)) {
      let github = await fetch(`https://api.github.com/users/${req.params.user}`);
      github = await github.json();
      console.log(req.params.user);
      console.log(github);
      
      res.render("userloggedin", {
        projects: projects,
        username: req.params.user,
        user: req.session.username,
        github: github
      });
    } else {
      console.log("not logged in and not me");
      console.log(req.params.user);
      
      let github = await fetch(`https://api.github.com/users/${req.params.user}`);
      github = await github.json();
      console.log(github);
      
      res.render("userpreview", {
        projects: projects,
        username: req.params.user,
        user: "not logged in!",
        github: github
      });
    }
  });
  
  app.get("/admin", async (req, res) => {
    
    if (req.session.username === 'khalby786' || req.session.username === '17lwinn') {
      let github = await fetch(`https://api.github.com/users/${req.params.username}`);
      
      res.render("admin", {
        github: github,
        users: await user.keys()
      });
    } else {
      res.sendStatus(401).send("Nice try, but this page doesn't exist for ya!")
    }
  
  })

  app.get("/me", (req, res) => {
    const username = req.session.username;
    res.redirect(`/u/${username}`);
  });

  app.get("/projectinfo/:projectname", async (req, res) => {
    const projectName = req.params.projectname;
    const projectinfo = await project.get(projectName);
    res.send({ name: projectinfo.name, owner: projectinfo.owner });
  });

  app.get("/logout", (req, res) => {
    req.session.loggedin = false;
    req.session.destroy(error => {
      if (error) throw error;
      res.redirect("/");
    });
  });
  
  app.get('*', function(req, res){
    res.status(404).send('<body style="background-color:black;"><center><a href="https://http.cat"><img src="https://http.cat/404"></a></center>');
  });

  app.get('*', function(req, res){
    res.status(500).send('<body style="background-color:black;"><center><a href="https://http.cat"><img src="https://http.cat/500"></a></center>');
  });

};
