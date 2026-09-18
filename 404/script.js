const backButton = document.querySelector("[data-go-back]");

backButton?.addEventListener("click", () => {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.href = "../index.html";
});
