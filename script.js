/* script_v58.js - Align SVG rings to image center (v5.8)
   Corrections :
   - SVG viewBox ajouté pour éviter les problèmes de mise à l'échelle
   - Les arcs sont dessinés sur 3/4 de cercle (225° -> 495°)
   - Conserve les points lumineux pour la moyenne
   - Version : 5.8
*/

const APP_VERSION = "3.1";
document.getElementById && document.getElementById("versionLabel") && (document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`);
const CSS_VERSION = "jarvis-v6";
document.getElementById && document.getElementById("cssVersionLabel") && (document.getElementById("cssVersionLabel").textContent = `CSS ${CSS_VERSION}`);
const SCRIPT_VERSION = "5.8";
document.getElementById && document.getElementById("scriptVersionLabel") && (document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`);

let monsters = [];
let averages = {};
let statsRange = {};
const SUGGESTION_LIMIT = 5;
const selectedMonsters = new Set();

async function loadMonsters() {
  try {
    const res = await fetch('bestiary_data.json');
    const raw = await res.json();
    monsters = raw.map(m => m.fields);
    console.log(`Loaded ${monsters.length} monsters`);

    const total = { hp:0, atk:0, def:0, spd:0 };
    const min = { hp:Infinity, atk:Infinity, def:Infinity, spd:Infinity };
    const max = { hp:-Infinity, atk:-Infinity, def:-Infinity, spd:-Infinity };
    let count = 0;
    monsters.filter(m => m.base_stars === 6 && m.is_awakened === true).forEach(m => {
      const hp = Number(m.max_lvl_hp) || 0;
      const atk = Number(m.max_lvl_attack) || 0;
      const def = Number(m.max_lvl_defense) || 0;
      const spd = Number(m.speed) || 0;
      if (hp && atk && def && spd) {
        total.hp += hp; total.atk += atk; total.def += def; total.spd += spd;
        min.hp = Math.min(min.hp, hp); min.atk = Math.min(min.atk, atk); min.def = Math.min(min.def, def); min.spd = Math.min(min.spd, spd);
        max.hp = Math.max(max.hp, hp); max.atk = Math.max(max.atk, atk); max.def = Math.max(max.def, def); max.spd = Math.max(max.spd, spd);
        count++;
      }
    });
    averages = {
      hp: count ? Math.round(total.hp / count) : 0,
      atk: count ? Math.round(total.atk / count) : 0,
      def: count ? Math.round(total.def / count) : 0,
      spd: count ? Math.round(total.spd / count) : 0
    };
    statsRange = { min, max };
    console.log("Averages:", averages, "Ranges:", statsRange);
  } catch (err) {
    console.error("Erreur chargement bestiary_data.json :", err);
  }
}

function normalizeStat(value, min, max) {
  const v = Number(value) || 0;
  if (max === min) return 100;
  return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg-90) * Math.PI / 180.0;
  return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
}

// describeArc that returns an SVG arc path from startAngle to endAngle (degrees)
function describeArc(x, y, radius, startAngle, endAngle){
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  // choose large-arc-flag based on sweep length
  const sweep = endAngle - startAngle;
  const largeArcFlag = (Math.abs(sweep) > 180) ? "1" : "0";
  // use sweep-flag = 1 to draw in the expected direction
  const d = ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y].join(" ");
  return d;
}

function createCard(monster) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card ring-card';

  const size = 180;
  const center = size/2;
  const hp = Number(monster.max_lvl_hp) || 0;
  const atk = Number(monster.max_lvl_attack) || 0;
  const def = Number(monster.max_lvl_defense) || 0;
  const spd = Number(monster.speed) || 0;

  const hpP = normalizeStat(hp, statsRange.min.hp, statsRange.max.hp);
  const atkP = normalizeStat(atk, statsRange.min.atk, statsRange.max.atk);
  const defP = normalizeStat(def, statsRange.min.def, statsRange.max.def);
  const spdP = normalizeStat(spd, statsRange.min.spd, statsRange.max.spd);

  const rings = [
    { key:'HP', value:hpP, mean: averages.hp ? normalizeStat(averages.hp, statsRange.min.hp, statsRange.max.hp) : 0, colorClass:'ring-hp', stroke:8, gap:6 },
    { key:'ATK', value:atkP, mean: averages.atk ? normalizeStat(averages.atk, statsRange.min.atk, statsRange.max.atk) : 0, colorClass:'ring-atk', stroke:8, gap:6 },
    { key:'DEF', value:defP, mean: averages.def ? normalizeStat(averages.def, statsRange.min.def, statsRange.max.def) : 0, colorClass:'ring-def', stroke:8, gap:6 },
    { key:'SPD', value:spdP, mean: averages.spd ? normalizeStat(averages.spd, statsRange.min.spd, statsRange.max.spd) : 0, colorClass:'ring-spd', stroke:8, gap:0 }
  ];

  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns,'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`); // important pour alignement
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  svg.classList.add('ring-svg');

  let currentRadius = center-6;

  // draw rings from outer to inner
  rings.forEach(r => {
    const radius = currentRadius - r.stroke/2;
    const startAngle = 225; // start at upper-left quadrant (so arc spans across top)
    const endAngle = 495;   // start + 270°

    // Track (full 3/4 arc background)
    const pathTrack = document.createElementNS(svgns, 'path');
    pathTrack.setAttribute('d', describeArc(center, center, radius, startAngle, endAngle));
    pathTrack.setAttribute('fill','none');
    pathTrack.setAttribute('stroke','rgba(255,255,255,0.05)');
    pathTrack.setAttribute('stroke-width', r.stroke);
    pathTrack.classList.add('ring-track');
    svg.appendChild(pathTrack);

    // Value arc (from startAngle to proportional angle)
    const valAngle = startAngle + (270 * (r.value/100));
    const pathVal = document.createElementNS(svgns,'path');
    pathVal.setAttribute('d', describeArc(center, center, radius, startAngle, valAngle));
    pathVal.setAttribute('fill','none');
    pathVal.setAttribute('stroke-width', r.stroke);
    pathVal.classList.add('ring-progress', r.colorClass);
    svg.appendChild(pathVal);

    // Mean point (small luminous dot)
    const meanAngle = startAngle + (270 * (r.mean/100));
    const meanPos = polarToCartesian(center, center, radius, meanAngle);
    const meanCircle = document.createElementNS(svgns,'circle');
    meanCircle.setAttribute('cx', meanPos.x);
    meanCircle.setAttribute('cy', meanPos.y);
    meanCircle.setAttribute('r', 3.5);
    meanCircle.classList.add('ring-mean', r.colorClass);
    svg.appendChild(meanCircle);

    currentRadius -= (r.stroke + r.gap);
  });

  // Image wrapper (centered) - image will be on top of SVG
  const imgWrap = document.createElement('div');
  imgWrap.className = 'ring-img-wrap';
  const img = document.createElement('img');
  img.className = 'monster ring-monster';
  if (monster.image_filename) img.src = `https://swarfarm.com/static/herders/images/monsters/${monster.image_filename}`;
  img.alt = monster.name || 'monster';
  imgWrap.appendChild(img);

  const title = document.createElement('h3');
  title.textContent = monster.name || '—';
  title.className = 'ring-title';

  const meta = document.createElement('p');
  meta.className = 'ring-meta';
  meta.innerHTML = `${monster.element ? `<img class="icon" src="icons/${monster.element.toLowerCase()}.png" alt="${monster.element}">` : ''} <span>${monster.element||'–'}</span> • <span>Archetype: ${monster.archetype||'–'}</span>`;

  const visual = document.createElement('div');
  visual.className = 'ring-visual';
  visual.appendChild(svg);
  visual.appendChild(imgWrap);

  const statsText = document.createElement('div');
  statsText.className = 'ring-stats-text';
  statsText.innerHTML = `<div class="stat-line">HP: ${hp}</div>
                         <div class="stat-line">ATK: ${atk}</div>
                         <div class="stat-line">DEF: ${def}</div>
                         <div class="stat-line">SPD: ${spd}</div>`;

  wrapper.appendChild(visual);
  wrapper.appendChild(title);
  wrapper.appendChild(meta);
  wrapper.appendChild(statsText);
  return wrapper;
}

// autocomplete & search (unchanged behavior)
function initMultiSearch() {
  const input = document.getElementById("multiInput");
  const btn = document.getElementById("multiBtn");
  const results = document.querySelector(".results-multi");
  const suggestions = document.getElementById("multiSuggestions");

  function doSearch() {
    const names = input.value.trim().toLowerCase().split(/\s+/);
    results.innerHTML = "";
    selectedMonsters.clear();
    names.forEach(n => {
      if (!n) return;
      const found = monsters.find(m => m.is_awakened === true && m.name && m.name.toLowerCase().includes(n));
      if (found && !selectedMonsters.has(found.name)) {
        selectedMonsters.add(found.name);
        results.appendChild(createCard(found));
      }
    });
  }

  btn.addEventListener("click", doSearch);
  input.addEventListener("keypress", e => { if (e.key === "Enter") doSearch(); });
  input.addEventListener("keydown", e => { if (e.key === "Escape") { input.value = ""; suggestions.innerHTML = ""; } });

  input.addEventListener("input", () => {
    const val = input.value.toLowerCase();
    suggestions.innerHTML = "";
    if (!val) return;
    const last = val.split(/\s+/).pop();
    if (!last) return;
    const matches = monsters.filter(m => m.is_awakened === true && m.name && m.name.toLowerCase().includes(last) && !selectedMonsters.has(m.name)).slice(0, SUGGESTION_LIMIT);
    matches.forEach(m => {
      const d = document.createElement('div'); d.className = 'suggestion'; d.textContent = m.name;
      d.addEventListener('click', () => {
        const parts = input.value.trim().split(/\s+/); parts.pop(); parts.push(m.name); input.value = parts.join(' ') + ' '; suggestions.innerHTML = '';
      });
      suggestions.appendChild(d);
    });
  });
}

function initReset() {
  const resetBtn = document.getElementById("resetBtn");
  if (!resetBtn) return;
  resetBtn.addEventListener("click", () => {
    selectedMonsters.clear();
    document.querySelectorAll("input").forEach(i => i.value = "");
    document.querySelectorAll(".results-multi").forEach(r => r.innerHTML = "");
    const suggestions = document.getElementById("multiSuggestions"); if (suggestions) suggestions.innerHTML = "";
  });
}

loadMonsters().then(() => { initMultiSearch(); initReset(); });
