const login = () => {
  var username = document.getElementsByClassName("username")[0].value;
  var password = document.getElementsByClassName("password")[0].value;
  var content = { username: username, password: password };
  fetch("/auth", {
    method: "post",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(content)
  })
    .then(response => response.json())
    .then(data => {
      if (data.redirect == "signup") {
        window.location.href = "https://glitchypastepen.glitch.me/signup";
      } else if (data.redirect == "editor") {
        window.location.href = "https://glitchypastepen.glitch.me/me";
      } else if (data.redirect == "/") {
        window.location.href =
          "https://glitchypastepen.glitch.me/redirect/loginfail";
      } else {
        console.log("yo!");
      }

      let username = data.username;
    });
};
