var editor = ace.edit("editor");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/html");
var io = require("socket.io");

document.addEventListener("keydown", function(event) {
  TogetherJS.reinitialize();
});

function beautify() {
  var beautify = ace.require("ace/ext/beautify");
  beautify.beautify(editor.session);
}

ace.require("ace/ext/language_tools");

editor.setOptions({
  fontSize: "1.5vw",
  fontFamily: "Fira Mono",
  enableBasicAutocompletion: true,
  autoScrollEditorIntoView: true
});

var EditSession = require("ace/edit_session").EditSession;

var html = new EditSession("<html></html>", "ace/mode/html");
var js = new EditSession("console.log('//hi')", "ace/mode/javascript");
var css = new EditSession("body { color: red; }", "ace/mode/css");

editor.setSession(html);
js.setOverwrite(true);
html.setOverwrite(true);
css.setOverwrite(true);

// Update cursor position with keyup
window.onkeyup = () => {
  let pos = editor.getCursorPosition();
  let col = pos.column;
  let row = pos.row;
  document.getElementById("pos").innerText = `${col}:${row}`;
};

// Custom commands
editor.commands.addCommand({
  name: "showKeyboardShortcuts",
  bindKey: { win: "Ctrl-Alt-h", mac: "Command-Alt-h" },
  exec: function(editor) {
    ace.config.loadModule("ace/ext/keybinding_menu", function(module) {
      module.init(editor);
      editor.showKeyboardShortcuts();
    });
  }
});

let projecturl = window.location.href;
let projectname = projecturl.slice(41);
document.getElementById("project-name").value = projectname;
document.getElementsByClassName("projectname")[0].innerText = projectname;
document.getElementsByClassName("projectname")[1].innerText = projectname;
// nice
// var socket = io('https://glitchypastepen.glitch.me',
// {
//   transports: ['websocket']
// });

// window.onkeyup = () => {
//   socket.emit("codeChange", {
//     html: html.getValue(),
//     js: js.getValue(),
//     css: css.getValue()
//   });
// }

let name = document.getElementById("project-name").value;
let path = "/getCode/" + name;
fetch(path)
  .then(response => response.json())
  .then(data => {
    // editor.setValue(data.code);
    console.log(data.css);
    console.log(data.js);
    html.setValue(data.code);
    js.setValue(data.js);
    css.setValue(data.css);
  });

fetch("/projectinfo/" + projectname)
  .then(response => response.json())
  .then(data => {
    document.getElementsByClassName("owner")[0].innerText = "by " + data.owner;
    document.getElementsByClassName("owner")[0].href = "/u/" + data.owner;
  });

function deploy() {
  let code = html.getValue();
  let js2 = js.getValue();
  let css2 = css.getValue();
  let name = document.getElementById("project-name").value;
  let content = { code: code, js: js2, css: css2, name: name };

  fetch("/deploy", {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(content)
  })
    .then(response => response.json())
    .then(data => {
      if (data.status === 200) {
        document.getElementById("status").style.display = "block";
        document.getElementById("status").onclick = function() {
          this.style.display = "none";
        };
        document.getElementById("status").innerHTML =
          'Your project has been successfully deployed <br />at <a href="/p/' +
          name +
          '">https://glitchypastepen.glitch.me/p/' +
          name +
          "</a>";
      } else {
        document.getElementById("status").style.display = "block";
        document.getElementById("status").style.backgroundColor = "red";
        document.getElementById("status").innerHTML =
          "Something went wrong! <br />Try again?";
      }
    });
}

function contributor() {
  console.log(projectname);
  let contributor = prompt(
    "Please username you would like to invite.",
    "khalby786"
  );
  let body = { project: projectname, user: contributor };
  if (contributor != null) {
    fetch("/contributor/" + projectname + "/" + contributor, {
      method: "POST",
      body: JSON.stringify(body)
    })
      .then(res => res.text())
      .then(data => {
        if (data === "200") {
          alert("Contributor added successfully!");
        } else if (data === "401") {
          alert("Unauthorised!");
        } else {
          alert("sorry, something went horribly wrong!");
        }
      });
  }
}

function cancel() {}

TogetherJSConfig_hubBase = "https://gpphub.herokuapp.com/";
TogetherJSConfig_findRoom = projecturl.slice(41);
