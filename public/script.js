// Editor elements, including Ace imported from Ace.js
const editor = ace.edit("editor");
const format = ace.require("ace/ext/beautify");
const io = require("socket.io");
const iframe = document.getElementById("devtool");
const editorDiv = document.getElementById("editor");
const footer = document.getElementById("editor-footer");
const projecturl = window.location.href;
const projectname = projecturl.slice(41);
const projectname_el = document.getElementById("project-name");

// Ace.js configurations
ace.require("ace/ext/language_tools");

editor.setTheme("ace/theme/vibrant_ink");
editor.session.setMode("ace/mode/html");

editor.setOptions({
  fontSize: "16px",
  fontFamily: "Fira Mono",
  enableSnippets: true,
  enableLiveAutocompletion: true, 
  autoScrollEditorIntoView: true
});

var EditSession = require("ace/edit_session").EditSession;

var html = new EditSession("<html></html>", "ace/mode/html");
var js = new EditSession("console.log('//hi')", "ace/mode/javascript");
var css = new EditSession("body { color: red; }", "ace/mode/css");

editor.setSession(html);
// js.setOverwrite(true);
// html.setOverwrite(true);
// css.setOverwrite(true);

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

// Beautify function beautify code
function beautify() {
  format.beautify(editor.session);
}

const cursorpos = () => {
  let pos = editor.getCursorPosition();
  let col = pos.column;
  let row = pos.row;
  document.getElementById("pos").innerText = `${col}:${row}`;
}

// Update cursor position with events
window.onload = () => {
  cursorpos();
}

window.onclick = () => {
  cursorpos();
};

window.onkeyup = () => {
  cursorpos();
};

projectname_el.value = projectname;
document.getElementById("preview-link").href = "https://glitchypastepen.glitch.me/p/" + projectname;

projectname_el.onclick = () => {
  simplecopy(projectname_el.value);
  projectname_el.value = "Copied!"
  setTimeout(() => projectname_el.value = projectname, 700)
}

/**
  *
  *FETCH REQUESTS TO FETCH INFO FROM BACKEND 
  *
**/

// Get project code
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

// Get project info like project owner
fetch("/projectinfo/" + projectname)
  .then(response => response.json())
  .then(data => {
    document.getElementsByClassName("owner")[0].innerText = "by " + data.owner;
    document.getElementsByClassName("owner")[0].href = "/u/" + data.owner;
  });

// Save your code and deploy!
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
        document.getElementById("status").innerHTML =
          'Your project has been successfully deployed <br />at <a href="/p/' +
          name +
          '">https://glitchypastepen.glitch.me/p/' +
          name +
          "</a>";
        swal.fire({
          html: 'Your project has been successfully saved and deployed <br />at <a href="/p/' + name + '">https://glitchypastepen.glitch.me/p/' + name + "</a>",
          icon: "success",
        });
      } else {
        swal.fire({
          text: "Something went wrong, try again?",
          icon: "error",
        });
      }
      
    });
}

// Add a new contributor to allow access to your project
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

// CSS adjustments using Javascript to dynamicaly set editor height
if (iframe.style.display === 'block') {
  editorDiv.style.bottom = iframe.style.height + footer.style.height;
  editor.resize(true);
} else {
  editorDiv.style.bottom = footer.style.height;
}

window.onload = () => {
  grecaptcha.execute();
}

function showCopyPopup() {
  swal.fire({
    text: "The code has been copied!",
    icon: "success",
  });
}
