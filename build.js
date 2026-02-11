const fs = require("fs");

const PHONE = process.env.PHONE;
if (!PHONE) throw new Error("Missing env var PHONE (set GitHub Secret PHONE)");

const menus = JSON.parse(fs.readFileSync("menus.json", "utf8"));

let state = { lastDate: null, lastProtein: null };
if (fs.existsSync("state.json")) {
  try { state = JSON.parse(fs.readFileSync("state.json", "utf8")); } catch {}
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
const options = menus?.[setKey]?.[dayName] ?? [];

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

function proteinOf(o) { return o?.protein?.[0] ?? null; }

// Penalizar cerdo para que quede más “cuando se pueda”
function optionRank(o) {
  const p = proteinOf(o);
  return (p === "cerdo") ? 10 : 0; // más alto = peor
}

// Elige Plan A/B/C sin repetir proteínas (cuando se puede)
function pickPlans(opts, lastProtein) {
  if (!opts.length) return { A: null, B: null, C: null };

  // Orden base: evita cerdo primero
  const sorted = [...opts].sort((a,b)=> optionRank(a) - optionRank(b));

  // Plan A: evitar repetir proteína de ayer si hay alternativa
  let A = sorted.find(o => proteinOf(o) && proteinOf(o) !== lastProtein) || sorted[0];

  // Plan B: proteína distinta a A (y si se puede, distinta a lastProtein también)
  let B = sorted.find(o => proteinOf(o) && proteinOf(o) !== proteinOf(A) && proteinOf(o) !== lastProtein)
       || sorted.find(o => proteinOf(o) && proteinOf(o) !== proteinOf(A))
       || null;

  // Plan C: otra proteína distinta a A y B. Cerdo puede caer acá “cuando se pueda”
  let C = sorted.find(o => {
    const p = proteinOf(o);
    return p && p !== proteinOf(A) && (!B || p !== proteinOf(B));
  }) || null;

  return { A, B, C };
}

function buildMessage(plans) {
  const { A, B, C } = plans;
  const lines = [];
  lines.push("☀️ Buen día abuela ❤️");
  lines.push(`📅 ${dayName} ${fecha}`);
  lines.push("");
  lines.push("🍽️ Almuerzo fit (½ proteína + ½ verduras):");

  function fmt(label, o) {
    if (!o) return null;
    const prot = (o.protein||[]).join(", ");
    const veg = (o.veg||[]).join(", ");
    return `✅ ${label}: ${o.title}\n🥩 Proteína: ${prot}\n🥦 Verduras: ${veg}`;
  }

  lines.push(fmt("Plan A", A));
  if (B) { lines.push(""); lines.push(fmt("Plan B", B)); }
  if (C) { lines.push(""); lines.push(fmt("Plan C", C)); }

  lines.push("");
  lines.push("Abrazo grande 😘");
  return lines.filter(Boolean).join("\n");
}

// Elegir planes
const plans = pickPlans(options, state.lastProtein);

// Actualizar state con la proteína del Plan A (para mañana)
if (plans.A) {
  state.lastDate = isoDate;
  state.lastProtein = proteinOf(plans.A);
  fs.writeFileSync("state.json", JSON.stringify(state, null, 2), "utf8");
}

const msg = options.length ? buildMessage(plans) : `No hay opciones cargadas para ${dayName} en el Set ${setKey}.`;
const waLink = `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}`;

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Menú Fit</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;padding:24px;background:#f6f7fb}
    .card{max-width:720px;margin:0 auto;background:#fff;border-radius:16px;padding:18px;box-shadow:0 6px 20px rgba(0,0,0,.08)}
    h1{font-size:20px;margin:0 0 10px}
    pre{white-space:pre-wrap;word-wrap:break-word;background:#f2f3f7;border-radius:12px;padding:14px;margin:12px 0}
    a,button{border:0;border-radius:12px;padding:12px 14px;font-size:16px;cursor:pointer;text-decoration:none;display:inline-block}
    a{background:#22c55e;color:#fff}
    button{background:#111827;color:#fff}
    .muted{color:#6b7280;font-size:13px}
    code{background:#e5e7eb;border-radius:6px;padding:2px 6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Menú Fit — ${escapeHtml(dayName)} (${escapeHtml(fecha)})</h1>
    <div class="muted">Set: <code>${escapeHtml(setKey)}</code> · Última proteína: <code>${escapeHtml(state.lastProtein ?? "—")}</code></div>

    <pre id="msg">${escapeHtml(msg)}</pre>

    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <a href="${waLink}">Enviar por WhatsApp</a>
      <button id="copy">Copiar</button>
    </div>
  </div>

<script>
  document.getElementById("copy").addEventListener("click", async () => {
    const text = document.getElementById("msg").innerText;
    try { await navigator.clipboard.writeText(text); alert("Copiado ✅"); }
    catch { alert("No pude copiar automático. Mantené apretado el texto y copiá manual ✅"); }
  });
</script>
</body>
</html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/index.html", html, "utf8");
fs.writeFileSync("docs/message.txt", msg, "utf8");
fs.writeFileSync("docs/wa_link.txt", waLink, "utf8");

console.log("Generated docs/index.html for:", dayName, fecha, "Set:", setKey);

