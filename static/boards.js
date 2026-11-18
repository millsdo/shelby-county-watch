const f = document.getElementById("bf");
f && f.addEventListener("input", () => {
  const q = f.value.toLowerCase();
  document.querySelectorAll("article.board").forEach((a) => { a.hidden = q && !a.textContent.toLowerCase().includes(q); });
  document.querySelectorAll("main section").forEach((s) => { s.hidden = q && !s.querySelector("article.board:not([hidden])"); });
});
