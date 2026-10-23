(() => {
  const r = document.getElementById("rfrule"), s = document.getElementById("rfsev"), g = document.getElementById("rfgov"), c = document.getElementById("rfcount");
  const p = new URLSearchParams(location.search);
  if (p.get("rule")) r.value = p.get("rule"); if (p.get("sev")) s.value = p.get("sev"); if (p.get("government")) g.value = p.get("government");
  const apply = () => {
    let n = 0;
    document.querySelectorAll("article.flag").forEach((a) => {
      const ok = (!r.value || a.dataset.rule === r.value) && (!s.value || (s.value === "high" ? a.dataset.sev === "high" : a.dataset.sev !== "low")) && (!g.value || a.dataset.gov === g.value);
      a.hidden = !ok; if (ok) n++;
    });
    c.textContent = `${n} shown`;
    const q = new URLSearchParams(); if (r.value) q.set("rule", r.value); if (s.value) q.set("sev", s.value); if (g.value) q.set("government", g.value);
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
  };
  [r, s, g].forEach((e) => e.addEventListener("change", apply)); apply();
})();
