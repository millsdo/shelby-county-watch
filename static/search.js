// Client-side search: Pagefind full-text index + precomputed watch-list category reports.
const ROOT = window.SITE_ROOT || "../";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (iso) => { if (!iso) return "Date unknown"; const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); };
const PAGE = 10, REPORT_PAGE = 150;
let meta, pagefind, state = { results: [], shown: 0, mode: null };

async function init() {
  meta = await (await fetch(ROOT + "data/meta.json")).json();
  for (const g of meta.governments) $("fgov").add(new Option(g, g));
  for (const c of meta.categories) $("fcat").add(new Option(`${c.name} (${c.count})`, c.name));
  fillBodies();
  const p = new URLSearchParams(location.search);
  $("q").value = p.get("q") || "";
  if (p.get("government")) { $("fgov").value = p.get("government"); fillBodies(); }
  if (p.get("body")) $("fbody").value = p.get("body");
  $("ffrom").value = p.get("from") || ""; $("fto").value = p.get("to") || "";
  if (p.get("cat")) $("fcat").value = p.get("cat");
  $("fgov").addEventListener("change", () => { fillBodies(); rerun(); });
  for (const id of ["fbody", "ffrom", "fto", "fcat"]) $(id).addEventListener("change", rerun);
  $("sform").addEventListener("submit", (e) => { e.preventDefault(); state.mode = "search"; runSearch(); });
  $("clear").addEventListener("click", () => { for (const id of ["q", "ffrom", "fto"]) $(id).value = ""; $("fgov").value = ""; fillBodies(); $("fcat").value = ""; $("results").innerHTML = ""; $("status").textContent = ""; state.mode = null; setUrl(); });
  document.querySelectorAll(".catbtn").forEach((b) => b.addEventListener("click", () => runReport(b.dataset.cat)));
  let t; $("q").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { if (state.mode !== "report") { state.mode = "search"; runSearch(); } }, 300); });
  if (p.get("report")) runReport(p.get("report"));
  else if ($("q").value || p.get("government") || p.get("body") || p.get("cat") || p.get("from") || p.get("to")) { state.mode = "search"; runSearch(); }
}

function fillBodies() {
  const g = $("fgov").value, cur = $("fbody").value, sel = $("fbody");
  sel.length = 1;
  for (const [gov, body] of meta.bodies) if (!g || gov === g) sel.add(new Option(g ? body : `${body} (${gov.replace(/^(City|Town) of /, "")})`, body));
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function rerun() { if (state.mode === "report") runReport(state.report); else if (state.mode === "search") runSearch(); else setUrl(); }

function datesInRange() {
  const f = $("ffrom").value, t = $("fto").value;
  if (!f && !t) return null;
  return meta.dates.filter((d) => (!f || d >= f) && (!t || d <= t));
}

function setUrl(extra = {}) {
  const p = new URLSearchParams();
  if ($("q").value) p.set("q", $("q").value);
  if ($("fgov").value) p.set("government", $("fgov").value);
  if ($("fbody").value) p.set("body", $("fbody").value);
  if ($("ffrom").value) p.set("from", $("ffrom").value);
  if ($("fto").value) p.set("to", $("fto").value);
  if ($("fcat").value) p.set("cat", $("fcat").value);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
}

async function loadPagefind() {
  if (pagefind) return pagefind;
  pagefind = await import(ROOT + "pagefind/pagefind.js");
  await pagefind.options({ baseUrl: new URL(ROOT, location.href).pathname, excerptLength: 40 });
  pagefind.init();
  return pagefind;
}

async function runSearch() {
  document.querySelectorAll(".catbtn").forEach((b) => b.classList.remove("active"));
  setUrl();
  const q = $("q").value.trim();
  const filters = {};
  if ($("fgov").value) filters.government = $("fgov").value;
  if ($("fbody").value) filters.body = $("fbody").value;
  if ($("fcat").value) filters.category = $("fcat").value;
  const dr = datesInRange();
  if (dr) { if (!dr.length) { show([], q); return; } filters.date = { any: dr }; }
  if (!q && !Object.keys(filters).length) { $("results").innerHTML = ""; $("status").textContent = ""; return; }
  $("status").textContent = "Searching…";
  try {
    const pf = await loadPagefind();
    const res = await pf.debouncedSearch(q || null, { filters, sort: q ? undefined : { date: "desc" } }, 150);
    if (res === null) return; // superseded
    show(res.results, q);
  } catch (e) { $("status").textContent = "Search index failed to load: " + e; }
}

function show(results, q) {
  state.results = results; state.shown = 0; state.q = q;
  $("results").innerHTML = "";
  $("status").textContent = results.length ? `${results.length} matching agenda section${results.length === 1 ? "" : "s"}${q ? ` for “${q}”` : ""}.` : "No matches. Try fewer words or wider filters.";
  more();
}

async function more() {
  const box = $("results");
  box.querySelector(".morebtn")?.remove();
  const slice = state.results.slice(state.shown, state.shown + PAGE);
  state.shown += slice.length;
  const datas = await Promise.all(slice.map((r) => r.data()));
  for (const d of datas) {
    const m = d.meta || {};
    const subs = (d.sub_results || []).filter((s) => s.excerpt).slice(0, 3);
    const quotes = (subs.length ? subs : [{ url: d.url, excerpt: d.excerpt }]).map((s) => `<li><blockquote>${s.excerpt}</blockquote><a href="${esc(s.url)}">View in agenda text</a></li>`).join("");
    const el = document.createElement("article");
    el.className = "result";
    el.innerHTML = `<h3><a href="${esc(d.url)}">${esc(m.title || d.url)}</a></h3>
      <p class="muted">${esc(m.government || "")}${m.doctitle ? " · " + esc(m.doctitle) : ""}${m.source ? ` · <a href="${esc(m.source)}" rel="noopener">Official agenda</a>` : ""}</p>
      ${state.q ? `<ul class="quotes">${quotes}</ul>` : ""}`;
    box.appendChild(el);
  }
  if (state.shown < state.results.length) {
    const b = document.createElement("button"); b.className = "morebtn secondary"; b.textContent = `Show more (${state.results.length - state.shown} left)`;
    b.onclick = more; box.appendChild(b);
  }
}

// ---------------- category reports
const catCache = {};
async function runReport(slug) {
  const cat = meta.categories.find((c) => c.slug === slug);
  if (!cat) return;
  state.mode = "report"; state.report = slug;
  document.querySelectorAll(".catbtn").forEach((b) => b.classList.toggle("active", b.dataset.cat === slug));
  setUrl({ report: slug });
  $("status").textContent = "Loading report…";
  const items = catCache[slug] || (catCache[slug] = await (await fetch(ROOT + `data/categories/${slug}.json`)).json());
  const g = $("fgov").value, b = $("fbody").value, f = $("ffrom").value, t = $("fto").value, q = $("q").value.trim().toLowerCase();
  const rows = items.filter((it) => {
    const d = meta.docs[it.d]; if (!d) return false;
    if (g && d.g !== g) return false; if (b && d.b !== b) return false;
    if (f && (!d.date || d.date < f)) return false; if (t && (!d.date || d.date > t)) return false;
    if (q && !(it.line + " " + it.b.join(" ") + " " + it.a.join(" ")).toLowerCase().includes(q)) return false;
    return true;
  });
  const byDoc = new Map();
  for (const it of rows) { if (!byDoc.has(it.d)) byDoc.set(it.d, []); byDoc.get(it.d).push(it); }
  const docs = [...byDoc.keys()].sort((a, c) => (meta.docs[c].date || "").localeCompare(meta.docs[a].date || "") || meta.docs[a].b.localeCompare(meta.docs[c].b));
  const termCounts = {};
  for (const it of rows) for (const x of it.t) termCounts[x] = (termCounts[x] || 0) + 1;
  const tc = Object.entries(termCounts).sort((a, c) => c[1] - a[1]).map(([k, v]) => `<span class="tag">${esc(k)} ${v}</span>`).join(" ");
  const filt = [g, b, f && "from " + f, t && "to " + t, q && `containing “${q}”`].filter(Boolean).join(", ");
  $("status").textContent = `${rows.length} matching line${rows.length === 1 ? "" : "s"} in ${docs.length} document${docs.length === 1 ? "" : "s"}.`;
  const box = $("results");
  box.innerHTML = `<section class="catreport"><h2>Report: ${esc(cat.name)}</h2>
    <p class="muted">Every agenda line containing one of this category's watch-list terms${filt ? " (" + esc(filt) + ")" : ""}. A match means the term appears in the text; read the full item in the official document.</p>
    <details><summary>Terms in this category (${cat.terms.length})</summary><p class="terms">${esc(cat.terms.join(", "))}</p></details>
    ${tc ? `<p class="tagline">Matches by term: ${tc}</p>` : ""}<div id="repdocs"></div></section>`;
  let budget = 0; const out = $("repdocs");
  const renderDoc = (id) => {
    const d = meta.docs[id], list = byDoc.get(id);
    const el = document.createElement("article"); el.className = "repdoc";
    el.innerHTML = `<h3>${esc(d.b)} <span class="muted">· ${esc(fmtDate(d.date))}</span></h3>
      <p class="muted">${esc(d.g)} · ${esc(d.title)} · <a href="${esc(d.src)}" rel="noopener">Official agenda</a> · ${list.length} line${list.length === 1 ? "" : "s"}</p>
      <ul class="quotes">${list.map((it) => `<li><blockquote>${it.b.map((l) => `<span class="ctx">${esc(l)}</span>`).join("")}<span class="hit">${hl(it.line, it.t)}</span>${it.a.map((l) => `<span class="ctx">${esc(l)}</span>`).join("")}</blockquote>
        <span class="muted">Terms: ${esc(it.t.join(", "))} · <a href="${ROOT}${esc(it.u)}">line ${it.ln} in agenda text</a></span></li>`).join("")}</ul>`;
    out.appendChild(el); budget += list.length;
  };
  let i = 0;
  const step = () => {
    out.parentElement.querySelector(".morebtn")?.remove();
    budget = 0;
    while (i < docs.length && (budget < REPORT_PAGE || budget === 0)) renderDoc(docs[i++]);
    if (i < docs.length) {
      const btn = document.createElement("button"); btn.className = "morebtn secondary";
      btn.textContent = `Show more (${docs.length - i} more documents)`; btn.onclick = step; out.after(btn);
    }
  };
  step();
}

function hl(line, terms) {
  let s = esc(line);
  for (const t of [...terms].sort((a, b) => b.length - a.length)) {
    const pat = esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s\\-]+");
    s = s.replace(new RegExp(`(^|[^A-Za-z0-9>])(${pat})`, t === t.toUpperCase() && /[A-Z]/.test(t) ? "g" : "gi"), "$1<mark>$2</mark>");
  }
  return s;
}

init();
