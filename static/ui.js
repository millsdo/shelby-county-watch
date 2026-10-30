// Freedom Ferret: filter chips, sorting, and URL state for cards. No dependencies.
(() => {
  document.querySelectorAll("[data-filterbar]").forEach((bar) => {
    const scope = document.querySelector(bar.dataset.scope || "main") || document;
    const state = {};
    const params = new URLSearchParams(location.search);
    bar.querySelectorAll("button[data-group]").forEach((b) => {
      const g = b.dataset.group, vals = (params.get(g) || "").split(",").filter(Boolean);
      if (vals.includes(b.dataset.value)) { (state[g] ||= new Set()).add(b.dataset.value); b.setAttribute("aria-pressed", "true"); }
    });
    const counter = bar.querySelector("[data-shown]");
    const apply = () => {
      let shown = 0, total = 0;
      scope.querySelectorAll("[data-card]").forEach((c) => {
        let ok = true;
        for (const g in state) {
          const s = state[g]; if (!s.size) continue;
          const attr = c.dataset[g]; if (attr === undefined) continue;
          if (!attr.split(" ").some((v) => s.has(v))) { ok = false; break; }
        }
        c.hidden = !ok; total++; if (ok) shown++;
      });
      scope.querySelectorAll("[data-cardlist]").forEach((l) => {
        const any = [...l.querySelectorAll("[data-card]")].some((c) => !c.hidden);
        l.classList.toggle("isempty", !any);
      });
      const active = Object.values(state).some((s) => s.size);
      if (counter) counter.textContent = active ? `${shown} of ${total} shown` : `${total} items`;
      bar.classList.toggle("active", active);
      const q = new URLSearchParams(location.search);
      ["btype", "gov", "cat", "sev", "rule"].forEach((g) => { const s = state[g]; s && s.size ? q.set(g, [...s].join(",")) : q.delete(g); });
      const qs = q.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    };
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-reset")) {
        for (const g in state) state[g].clear();
        bar.querySelectorAll("button[data-group]").forEach((x) => x.setAttribute("aria-pressed", "false"));
      } else if (b.dataset.group) {
        const s = (state[b.dataset.group] ||= new Set()), v = b.dataset.value;
        s.has(v) ? s.delete(v) : s.add(v);
        b.setAttribute("aria-pressed", s.has(v) ? "true" : "false");
      } else return;
      apply();
    });
    apply();
  });
  document.querySelectorAll("select[data-sort]").forEach((sel) => {
    const box = document.querySelector(sel.dataset.sort); if (!box) return;
    const key = {
      default: (c) => [+c.dataset.sevrank, -(+c.dataset.amt || 0), +c.dataset.idx],
      amt: (c) => [-(+c.dataset.amt || 0), +c.dataset.sevrank, +c.dataset.idx],
      date: (c) => [c.dataset.date || "9999", +c.dataset.sevrank, +c.dataset.idx],
    };
    const cmp = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };
    const p = new URLSearchParams(location.search); if (p.get("sort") && key[p.get("sort")]) sel.value = p.get("sort");
    const run = () => {
      const f = key[sel.value] || key.default, empty = box.querySelector(".emptymsg");
      [...box.querySelectorAll("[data-card]")].sort((a, b) => cmp(f(a), f(b))).forEach((c) => box.insertBefore(c, empty));
      const q = new URLSearchParams(location.search); sel.value === "default" ? q.delete("sort") : q.set("sort", sel.value);
      history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
    };
    sel.addEventListener("change", run); run();
  });
})();
