/* script_v53.js - Génère des anneaux concentriques autour de l'image du monstre */
/* Versions */
const APP_VERSION = "2.9";
document.getElementById && document.getElementById("versionLabel") && (document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`);
const CSS_VERSION = "jarvis-v4";
document.getElementById && document.getElementById("cssVersionLabel") && (document.getElementById("cssVersionLabel").textContent = `CSS ${CSS_VERSION}`);
const SCRIPT_VERSION = "5.3";
document.getElementById && document.getElementById("scriptVersionLabel") && (document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`);

/* Données & constantes */
let monsters = [];
let averages = {};
let statsRange = {};
const SUGGESTION_LIMIT = 5;
const selectedMonsters = new Set();

/* Chargement des monstres */
async function loadMonsters() {
  try {
    const res = await fetch('bestiary_data.json');
    const raw = await res.json();
    monsters = raw.map(m => m.fields);
    console.log(`Loaded ${monsters.length} monsters`);

    // calcul des moyennes et ranges sur 6★ éveillés (comme avant)
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

/* UTIL: calcule pourcentage entre min/max, protège division par zéro */
function normalizeStat(value, min, max) {
  const v = Number(value) || 0;
  if (max === min) return 100;
  return Math.max(0, Math.min(100, Math.round(((v - min) / (max - min)) * 100)));
}

/* Rend une carte avec anneaux concentriques */
function createCard(monster) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card ring-card';
  // dimensions du SVG
  const size = 180; // px
  const center = size / 2;
  // stat values (utilise max_lvl_* pour cohérence)
  const hp = Number(monster.max_lvl_hp) || 0;
  const atk = Number(monster.max_lvl_attack) || 0;
  const def = Number(monster.max_lvl_defense) || 0;
  const spd = Number(monster.speed) || 0;

  // calcul % selon statsRange (qui est sur 6* éveillés pour min/max)
  const hpP = normalizeStat(hp, statsRange.min.hp, statsRange.max.hp);
  const atkP = normalizeStat(atk, statsRange.min.atk, statsRange.max.atk);
  const defP = normalizeStat(def, statsRange.min.def, statsRange.max.def);
  const spdP = normalizeStat(spd, statsRange.min.spd, statsRange.max.spd);

  // configuration des anneaux (ordre du plus externe au plus interne)
  const rings = [
    { key: 'HP', value: hpP, colorClass: 'ring-hp', stroke: 8, gap: 6 },
    { key: 'ATK', value: atkP, colorClass: 'ring-atk', stroke: 8, gap: 6 },
    { key: 'DEF', value: defP, colorClass: 'ring-def', stroke: 8, gap: 6 },
    { key: 'SPD', value: spdP, colorClass: 'ring-spd', stroke: 8, gap: 0 }
  ];

  // build svg with concentric circles
  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('ring-svg');

  // starting radius for outermost ring
  let currentRadius = center - 6; // leave small padding

  rings.forEach((r, i) => {
    const radius = currentRadius - r.stroke/2;
    const circumference = Math.PI * 2 * radius;
    // background circle (track)
    const track = document.createElementNS(svgns, 'circle');
    track.setAttribute('cx', center);
    track.setAttribute('cy', center);
    track.setAttribute('r', radius);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255,255,255,0.03)');
    track.setAttribute('stroke-width', r.stroke);
    track.classList.add('ring-track');
    svg.appendChild(track);

    // progress circle
    const prog = document.createElementNS(svgns, 'circle');
    prog.setAttribute('cx', center);
    prog.setAttribute('cy', center);
    prog.setAttribute('r', radius);
    prog.setAttribute('fill', 'none');
    prog.setAttribute('stroke-width', r.stroke);
    prog.setAttribute('stroke-linecap', 'round');
    prog.classList.add('ring-progress', r.colorClass);
    // stroke-dasharray/dashoffset to show progress (we draw from top -> rotate -90deg later)
    prog.setAttribute('stroke-dasharray', `${circumference} ${circumference}`);
    const dashoffset = circumference * (1 - r.value/100);
    prog.setAttribute('stroke-dashoffset', dashoffset);
    // rotate so 0% is at top (12 o'clock)
    prog.setAttribute('transform', `rotate(-90 ${center} ${center})`);
    svg.appendChild(prog);

    currentRadius -= (r.stroke + r.gap);
  });

  // image element centered
  const imgWrap = document.createElement('div');
  imgWrap.className = 'ring-img-wrap';
  const img = document.createElement('img');
  img.className = 'monster ring-monster';
  if (monster.image_filename) {
    img.src = `https://swarfarm.com/static/herders/images/monsters/${monster.image_filename}`;
  } else {
    img.src = '';
  }
  img.alt = monster.name || 'monster';

  // label name
  const title = document.createElement('h3');
  title.textContent = monster.name || '—';
  title.className = 'ring-title';

  // small meta (element + archetype)
  const meta = document.createElement('p');
  meta.className = 'ring-meta';
  meta.innerHTML = `${monster.element ? `<img class="icon" src="icons/${monster.element.toLowerCase()}.png" alt="${monster.element}">` : ''} <span>${monster.element||'–'}</span> • <span>Archetype: ${monster.archetype||'–'}</span>`;

  imgWrap.appendChild(img);

  // assemble card: svg behind the image, use positioning via CSS
  const visual = document.createElement('div');
  visual.className = 'ring-visual';
  visual.appendChild(svg);
  visual.appendChild(imgWrap);

  // stats textual (optional small labels)
  const statsText = document.createElement('div');
  statsText.className = 'ring-stats-text';
  statsText.innerHTML = `<div class="stat-line">HP: ${hp} (${hpP}%)</div>
                         <div class="stat-line">ATK: ${atk} (${atkP}%)</div>
                         <div class="stat-line">DEF: ${def} (${defP}%)</div>
                         <div class="stat-line">SPD: ${spd} (${spdP}%)</div>`;

  wrapper.appendChild(visual);
  wrapper.appendChild(title);
  wrapper.appendChild(meta);
  wrapper.appendChild(statsText);

  return wrapper;
}

/* Autocomplete & recherche multi (conserve comportement v5.2) */
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

  // Escape clears
  input.addEventListener("keydown", e => { if (e.key === "Escape") { input.value = ""; suggestions.innerHTML = ""; } });

  // autocomplete basic (last word)
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

/* Reset */
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

/* Init */
loadMonsters().then(() => {
  initMultiSearch();
  initReset();
});