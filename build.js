const fs = require("fs");

const PHONE = process.env.PHONE;
if (!PHONE) throw new Error("Missing env var PHONE (set GitHub Secret PHONE)");

const menus = JSON.parse(fs.readFileSync("menus.json", "utf8"));

let state = { lastDate: null, lastProtein: null };
if (fs.existsSync("state.json")) {
  try {
    state = JSON.parse(fs.readFileSync("state.json", "utf8"));
  } catch {}
}

const dias = ["DOMINGO","LUNES","MARTES","MIERCOLES","JUEVES","VIERNES","SABADO"];
const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
const dayName = dias[now.getDay()];

const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");
const dd = String(now.getDate()).padStart(2, "0");
const fecha = `${dd}/${mm}/${yyyy}`;
const isoDate = `${yyyy}-${mm}-${dd}`;

// Regla (b): Lun–Jue Set A, Vie–Dom Set B
const setKey = ["VIERNES","SABADO","DOMINGO"].includes(dayName) ? "B" : "A";
const todaysOptions = menus?.[setKey]?.[dayName] ?? [];

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

function scoreOption(opt, selected) {
  const need = [...(opt.protein||[]), ...(opt.veg||[]), ...(opt.extras||[])];
  let have = 0;
  for (const ing of need) if (selected.includes(ing)) have++;
  const missing = need.length - have;

  const hasProtein = (opt.protein||[]).some(x => selected.includes(x));
  const hasVeg = (opt.veg||[]).some(x => selected.includes(x));
  const base = (hasProtein ? 10 : 0) + (hasVeg ? 10 : 0);

  // “Cerdo cuando se pueda”: lo penalizo para que no salga Plan A salvo que sea lo mejor
  const porkPenalty = (opt.protein?.[0] === "cerdo") ? 3 : 0;

  return { score: base + have - porkPenalty, missing };
}

function pickPlans(options, selected, lastProtein) {
  const scored = options.map(o => {
    const protein = (o.protein?.[0] ?? null);
    return { o, protein, ...scoreOption(o, selected) };
  });

  // Evitar repetir proteína del día anterior (si hay alternativas)
  const filtered = lastProtein ? scored.filter(x => x.protein !== lastProtein) : scored;

  const pool = (filtered.length ? filtered : scored)
    .sort((a,b)=> b.score - a.score || a.missing - b.missing);

  const best = pool[0]?.o || null;
  const alts = pool.slice(1,3).map(x=>x.o);
  return { best, alts };
}

function buildMessage(best, alts) {
  const lines = [];
  lines.push("☀️ Buen día abuela ❤️");
  lines.push(`📅 ${dayName} ${fecha}`);
  lines.push("");
  lines.push("🍽️ Almuerzo fit (½ proteína + ½ verduras):");
  lines.push(`✅ Plan A: ${best.title}`);
  lines.push(`🥩 Proteína: ${(best.protein||[]).join(", ") || "—"}`);
  lines.push(`🥦 Verduras: ${(best.veg||[]).join(", ") || "—"}`);

  if (alts.length) {
    lines.push("");
    lines.push("🔁 Si no tenés algo, alternativas:");
    alts.forEach((o, idx) => {
      const letter = idx === 0 ? "B" : "C";
      lines.push(`• Plan ${letter}: ${o.title} (proteína: ${(o.protein||[]).join(", ") || "—"})`);
    });
  }

  lines.push("");
  lines.push("Abrazo grande 😘");
  return lines.join("\n");
}

// Ingredients checklist: unión de ingredientes de hoy + comodines
const allIngredients = new Set();
for (const opt of todaysOptions) {
  [...(opt.protein||[]), ...(opt.veg||[]), ...(opt.extras||[])].forEach(x => allIngredients.add(x));
}
["sal","aceite","limon","tomate","cebolla","zanahoria","lechuga","morrón","zapallito","pepino"].forEach(x => allIngredients.add(x));
const ingredientList = Array.from(allIngredients).sort((a,b)=>a.localeCompare(b, "es"));

// Build-time default (para actualizar state y evitar repeticiones mañana)
const commonSelected = ["sal","aceite","limon","tomate","cebolla","zanahoria","lechuga"];
const pickedDefault = pickPlans(todaysOptions, commonSelected, state.lastProtein);
if (pickedDefault.best) {
  state.lastDate = isoDate;
  state.lastProtein = pickedDefault.best.protein?.[0] ?? state.lastProtein;
  fs.writeFileSync("state.json", JSON.stringify(state, null, 2), "utf8");
}

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Menú Fit</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;padding:24px;background:#f6f7fb}
    .card{max-width:820px;margin:0 auto;background:#fff;border-radius:16px;padding:18px;box-shadow:0 6px 20px rgba(0,0,0,.08)}
    h1{font-size:20px;margin:0 0 10px}
    .row{display:flex;gap:16px;flex-wrap:wrap}
    .box{flex:1;min-width:280px;background:#f2f3f7;border-radius:14px;padding:12px}
    .ing{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
    label{display:flex;gap:8px;align-items:center;font-size:14px}
    button,a{border:0;border-radius:12px;padding:12px 14px;font-size:16px;cursor:pointer;text-decoration:none;display:inline-block}
    button{background:#111827;color:#fff}
    a{background:#22c55e;color:#fff}
    pre{white-space:pre-wrap;word-wrap:break-word;background:#fff;border-radius:12px;padding:14px;margin:12px 0}
    .muted{color:#6b7280;font-size:13px}
    .pill{display:inline-block;background:#e5e7eb;border-radius:999px;padding:4px 10px;margin:4px 6px 0 0;font-size:12px}
    code{background:#e5e7eb;border-radius:6px;padding:2px 6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Menú Fit — ${escapeHtml(dayName)} (${escapeHtml(fecha)})</h1>
    <div class="muted">
      Set de hoy: <code>${escapeHtml(setKey)}</code>
      · Proteína anterior (state): <code>${escapeHtml(state.lastProtein ?? "—")}</code>
    </div>

    ${todaysOptions.length === 0 ? `
      <p style="margin-top:14px">No hay opciones cargadas para hoy en <code>menus.json</code>.</p>
    ` : `
    <div class="row" style="margin-top:14px">
      <div class="box">
        <b>Ingredientes disponibles</b>
        <div class="muted">Tildá lo que tenga tu abuela hoy y tocá “Recomendar”.</div>
        <div class="ing">
          ${ingredientList.map(i => `<label><input type="checkbox" value="${escapeHtml(i)}"/> ${escapeHtml(i)}</label>`).join("")}
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
          <button id="btnReco">Recomendar</button>
          <button id="btnClear">Limpiar</button>
        </div>
      </div>

      <div class="box">
        <b>Mensaje para WhatsApp</b>
        <div id="recHint" class="muted" style="margin-top:6px">Todavía no elegí ninguna opción.</div>
        <div id="chips"></div>
        <pre id="msg" style="display:none"></pre>
        <div id="actions" style="display:none;gap:10px;flex-wrap:wrap;margin-top:10px">
          <a id="wa" href="#">Enviar por WhatsApp</a>
          <button id="copy">Copiar</button>
        </div>
      </div>
    </div>
    `}
  </div>

<script>
  const options = ${JSON.stringify(todaysOptions)};
  const phone = ${JSON.stringify(PHONE)};
  const dayName = ${JSON.stringify(dayName)};
  const fecha = ${JSON.stringify(fecha)};
  const lastProtein = ${JSON.stringify(state.lastProtein)};

  function getSelectedIngredients() {
    return Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
  }

  function scoreOption(opt, selected) {
    const need = [...(opt.protein||[]), ...(opt.veg||[]), ...(opt.extras||[])];
    let have = 0;
    for (const ing of need) if (selected.includes(ing)) have++;
    const missing = need.length - have;

    const hasProtein = (opt.protein||[]).some(x => selected.includes(x));
    const hasVeg = (opt.veg||[]).some(x => selected.includes(x));
    const base = (hasProtein ? 10 : 0) + (hasVeg ? 10 : 0);
    const porkPenalty = (opt.protein?.[0] === "cerdo") ? 3 : 0;
    return { score: base + have - porkPenalty, missing };
  }

  function pickPlans(options, selected, lastProtein) {
    const scored = options.map(o => {
      const protein = (o.protein?.[0] ?? null);
      return { o, protein, ...scoreOption(o, selected) };
    });

    const filtered = lastProtein ? scored.filter(x => x.protein !== lastProtein) : scored;
    const pool = (filtered.length ? filtered : scored)
      .sort((a,b)=> b.score - a.score || a.missing - b.missing);

    const best = pool[0]?.o || null;
    const alts = pool.slice(1,3).map(x=>x.o);
    return { best, alts };
  }

  function buildMessage(best, alts) {
    const lines = [];
    lines.push("☀️ Buen día abuela ❤️");
    lines.push(\`📅 \${dayName} \${fecha}\`);
    lines.push("");
    lines.push("🍽️ Almuerzo fit (½ proteína + ½ verduras):");
    lines.push(\`✅ Plan A: \${best.title}\`);
    lines.push(\`🥩 Proteína: \${(best.protein||[]).join(", ") || "—"}\`);
    lines.push(\`🥦 Verduras: \${(best.veg||[]).join(", ") || "—"}\`);

    if (alts.length) {
      lines.push("");
      lines.push("🔁 Si no tenés algo, alternativas:");
      alts.forEach((o, idx) => {
        const letter = idx === 0 ? "B" : "C";
        lines.push(\`• Plan \${letter}: \${o.title} (proteína: \${(o.protein||[]).join(", ") || "—"})\`);
      });
    }

    lines.push("");
    lines.push("Abrazo grande 😘");
    return lines.join("\\n");
  }

  function renderPlans(best, alts) {
    const chips = document.getElementById("chips");
    const plans = [best, ...alts].filter(Boolean);
    chips.innerHTML = '<div class="muted" style="margin-top:8px">Planes:</div>' +
      plans.map((o, idx) => {
        const letter = idx === 0 ? "A" : (idx === 1 ? "B" : "C");
        return '<span class="pill">Plan ' + letter + ': ' + o.title + '</span>';
      }).join("");
  }

  function updateUI(text) {
    const msgEl = document.getElementById("msg");
    const waEl = document.getElementById("wa");
    msgEl.style.display = "block";
    msgEl.textContent = text;
    document.getElementById("actions").style.display = "flex";
    waEl.href = "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
  }

  const btnReco = document.getElementById("btnReco");
  if (btnReco) {
    btnReco.addEventListener("click", () => {
      const selected = getSelectedIngredients();
      const { best, alts } = pickPlans(options, selected, lastProtein);
      if (!best) return;

      document.getElementById("recHint").textContent =
        "Plan A sugerido: " + best.title + (lastProtein ? (" (evitando repetir: " + lastProtein + ")") : "");

      renderPlans(best, alts);
      updateUI(buildMessage(best, alts));
    });
  }

  const btnClear = document.getElementById("btnClear");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      document.querySelectorAll('input[type="checkbox"]').forEach(x => x.checked = false);
      document.getElementById("recHint").textContent = "Todavía no elegí ninguna opción.";
      document.getElementById("chips").innerHTML = "";
      document.getElementById("msg").style.display = "none";
      document.getElementById("actions").style.display = "none";
    });
  }

  const copyBtn = document.getElementById("copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = document.getElementById("msg").innerText;
      try { await navigator.clipboard.writeText(text); alert("Copiado ✅"); }
      catch { alert("No pude copiar automático. Mantené apretado el texto y copiá manual ✅"); }
    });
  }
</script>
</body>
</html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/index.html", html, "utf8");
console.log("Generated docs/index.html for:", dayName, fecha, "Set:", setKey);
