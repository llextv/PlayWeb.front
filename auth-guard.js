(() => {
  document.documentElement.style.visibility = "hidden";

  let token = null;
  try {
    const storedValue = localStorage.getItem("websteam.session.v2");
    try {
      token = JSON.parse(storedValue || "null")?.token;
    } catch {
      token = storedValue;
    }
  } catch {
    token = null;
  }

  if (!token) {
    window.location.replace("../index/index.html");
    return;
  }

  document.documentElement.style.visibility = "visible";
})();
