
const fs = require("fs");

const PHONE = process.env.PHONE;
if (!PHONE) throw new Error("Missing env var PHONE");

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

// Regla b: Lun–Jue A, Vie–Dom B
const setKey = ["VIERNES","SABADO","DOMINGO"].includes(dayName) ? "B" : "A";
const todaysOptions = menus?.[setKey]?.[dayName] ?? [];

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
  lines.push("☀️ Buen día ❤️");
  lines.push(`📅 ${dayName} ${fecha}`);
  lines.push("");
  lines.push("🍽️ Almuerzo fit (½ proteína + ½ verduras):");
  lines.push(`✅ Plan A: ${best.title}`);
  lines.push(`🥩 Proteína: ${(best.protein||[]).join(", ") || "—"}`);
  lines.push(`🥦 Verduras: ${(best.veg||[]).join(", ") || "—"}`);

  if (alts.length) {
    lines.push("");
    lines.push("🔁 Alternativas:");
    alts.forEach((o, idx) => {
      const letter = idx === 0 ? "B" : "C";
      lines.push(`• Plan ${letter}: ${o.title} (proteína: ${(o.protein||[]).join(", ") || "—"})`);
    });
  }
  lines.push("");
  lines.push("Abrazo 😘");
  return lines.join("\n");
}

// Ingredients checklist
const allIngredients = new Set();
for (const opt of todaysOptions) {
  [...(opt.protein||[]), ...(opt.veg||[]), ...(opt.extras||[])].forEach(x => allIngredients.add(x));
}
["sal","aceite","limon","tomate","cebolla","zanahoria","lechuga","morrón","zapallito","pepino"].forEach(x => allIngredients.add(x));
const ingredientList = Array.from(allIngredients).sort((a,b)=>a.localeCompare(b, "es"));

// Build-time default plan to update state
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
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Menú Fit</title>
<style>
body{font-family:system-ui;margin:0;padding:24px;background:#f6f7fb}
.card{max-width:820px;margin:auto;background:#fff;border-radius:16px;padding:18px;box-shadow:0 6px 20px rgba(0,0,0,.08)}
.box{background:#f2f3f7;border-radius:14px;padding:12px;margin-top:12px}
.ing{display:grid;grid-template-columns:1fr 1fr;gap:8px}
button,a{border-radius:12px;padding:12px 14px;font-size:16px;text-decoration:none;border:0}
button{background:#111827;color:#fff}
a{background:#22c55e;color:#fff}
pre{white-space:pre-wrap;background:#fff;border-radius:12px;padding:14px}
</style>
</head>
<body>
<div class="card">
<h2>${dayName} ${fecha} — Set ${setKey}</h2>
<div class="box">
<b>Ingredientes</b>
<div class="ing">
${ingredientList.map(i=>`<label><input type="checkbox" value="${i}"/> ${i}</label>`).join("")}
</div>
<button id="reco">Recomendar</button>
</div>
<div class="box">
<pre id="msg"></pre>
<a id="wa" href="#">Enviar por WhatsApp</a>
</div>
</div>
<script>
const options = ${JSON.stringify(todaysOptions)};
const lastProtein = ${JSON.stringify(state.get("lastProtein"))};
const phone = ${JSON.stringify("${PHONE}")};
function scoreOption(opt, selected){
  const need=[...(opt.protein||[]),...(opt.veg||[])];
  let have=0; for(const i of need) if(selected.includes(i)) have++;
  return have;
}
function pick(options, selected){
  const scored=options.map(o=>({o,protein:o.protein?.[0],score:scoreOption(o,selected)}));
  const f=lastProtein?scored.filter(x=>x.protein!==lastProtein):scored;
  const pool=(f.length?f:scored).sort((a,b)=>b.score-a.score);
  return pool.slice(0,3).map(x=>x.o);
}
document.getElementById("reco").onclick=()=>{
  const sel=[...document.querySelectorAll("input:checked")].map(x=>x.value);
  const plans=pick(options,sel);
  if(!plans.length) return;
  const text=${json.dumps(buildMessage := "")};
};
</script>
</body>
</html>`;

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/index.html", html, "utf8");
