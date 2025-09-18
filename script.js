/* script.js v3.9 - corrected and complete
   - Loads bestiary_data.json
   - Autocomplete for 3 single inputs and the multi-input (last word)
   - Prevent duplicate selections across all inputs
   - Computes min/max/average and renders progress bars
   - Comments included for clarity
*/

const APP_VERSION = "2.9";
document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`;

const CSS_VERSION = "3.9";
document.getElementById("cssVersionLabel").textContent = `CSS v${CSS_VERSION}`;

const SCRIPT_VERSION = "3.9";
document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`;

let monsters = [];
let averages = {};
let statsRange = {};
const SUGGESTION_LIMIT = 5;
const selectedMonsters = new Set(); // noms sélectionnés définitivement

// -----------------------
// Load data and compute stats
// -----------------------
async function loadMonsters() {
  try {
    const res = await fetch('bestiary_data.json');
    monsters = await res.json();
    console.log(`Loaded ${monsters.length} monsters from bestiary_data.json`);

    // compute totals / min / max for relevant fields
    const total = { hp:0, atk:0, def:0, spd:0, stars:0 };
    const min = { hp:Infinity, atk:Infinity, def:Infinity, spd:Infinity, stars:Infinity };
    const max = { hp:-Infinity, atk:-Infinity, def:-Infinity, spd:-Infinity, stars:-Infinity };
    let count = 0;

    monsters.forEach(m => {
      // safe numeric extraction (some entries may use strings or be missing)
      const stars = Number(m.base_stars) || 0;
      const hp = Number(m.max_lvl_hp) || 0;
      const atk = Number(m.max_lvl_attack) || 0;
      const def = Number(m.max_lvl_defense) || 0;
      const spd = Number(m.speed) || 0;
      // only consider entries with non-zero numeric stats for averages
      if (hp || atk || def || spd || stars) {
        total.stars += stars;
        total.hp += hp;
        total.atk += atk;
        total.def += def;
        total.spd += spd;

        min.stars = Math.min(min.stars, stars);
        min.hp = Math.min(min.hp, hp);
        min.atk = Math.min(min.atk, atk);
        min.def = Math.min(min.def, def);
        min.spd = Math.min(min.spd, spd);

        max.stars = Math.max(max.stars, stars);
        max.hp = Math.max(max.hp, hp);
        max.atk = Math.max(max.atk, atk);
        max.def = Math.max(max.def, def);
        max.spd = Math.max(max.spd, spd);

        count++;
      }
    });

    // avoid division by zero
    if (count === 0) count = 1;
    averages = {
      stars: +(total.stars / count).toFixed(1),
      hp: Math.round(total.hp / count),
      atk: Math.round(total.atk / count),
      def: Math.round(total.def / count),
      spd: Math.round(total.spd / count)
    };
    statsRange = { min, max };
    console.log('Averages:', averages, 'Ranges:', statsRange);
  } catch (err) {
    console.error('Error loading bestiary_data.json', err);
  }
}

// -----------------------
// Render helpers: stats as progress bars
// -----------------------
function clamp(v, a=0, b=100){ return Math.max(a, Math.min(b, v)); }

function renderStat(label, valueRaw, avgRaw, minRaw, maxRaw) {
  const value = Number(valueRaw) || 0;
  const avg = Number(avgRaw) || 0;
  const min = Number(minRaw) || 0;
  const max = Number(maxRaw) || 0;

  // avoid division by zero — if min==max, show full bar and place avg at 50%
  let percent = 100;
  let avgPercent = 50;
  if (max > min) {
    percent = ((value - min) / (max - min)) * 100;
    avgPercent = ((avg - min) / (max - min)) * 100;
  }
  percent = clamp(percent, 0, 100);
  avgPercent = clamp(avgPercent, 0, 100);

  const colorClass = value >= avg ? 'green' : 'red';
  return `
    <div class="stat">
      <span><strong>${label}:</strong> ${value}</span>
      <div class="progress-bar" role="img" aria-label="${label} value ${value}">
        <div class="progress ${colorClass}" style="width:${percent}%;"></div>
        <div class="avg-marker" style="left:${avgPercent}%;"></div>
      </div>
      <small>min:${min} | moy:${avg} | max:${max}</small>
    </div>
  `;
}

// -----------------------
// Card creation
// -----------------------
function createCard(monster) {
  const imgUrl = monster.image_filename ? `https://swarfarm.com/static/herders/images/monsters/${monster.image_filename}` : '';
  const elemIconUrl = monster.element ? `icons/${monster.element.toLowerCase()}.png` : '';
  const card = document.createElement('div');
  card.className = 'card fade-in';
  card.innerHTML = `
    <img class="monster" src="${imgUrl}" alt="${monster.name}">
    <h3>${monster.name}</h3>
    <p>
      ${elemIconUrl ? `<img class="icon" src="${elemIconUrl}" alt="${monster.element}">` : ''}
      <span class="small">${monster.element || '–'}</span><br>
      <span class="small">Archetype: ${monster.archetype || '–'}</span>
    </p>
    <div class="stat-grid">
      ${renderStat('Étoiles', monster.base_stars, averages.stars, statsRange.min.stars, statsRange.max.stars)}
      ${renderStat('HP', monster.max_lvl_hp, averages.hp, statsRange.min.hp, statsRange.max.hp)}
      ${renderStat('ATK', monster.max_lvl_attack, averages.atk, statsRange.min.atk, statsRange.max.atk)}
      ${renderStat('DEF', monster.max_lvl_defense, averages.def, statsRange.min.def, statsRange.max.def)}
      ${renderStat('Vitesse', monster.speed, averages.spd, statsRange.min.spd, statsRange.max.spd)}
    </div>
  `;
  return card;
}

// -----------------------
// Autocomplete + search for single blocks
// -----------------------
function initSearchBlock(block) {
  const input = block.querySelector('input');
  const btn = block.querySelector('button');
  const suggestions = block.querySelector('.suggestions');
  const results = block.querySelector('.results');
  let activeIndex = -1;

  function clearSuggestions() { suggestions.innerHTML = ''; activeIndex = -1; }
  function updateSuggestions() {
    const q = input.value.trim().toLowerCase();
    clearSuggestions();
    if (!q) return;
    const matches = monsters
      .filter(m => m.name && m.name.toLowerCase().includes(q))
      .filter(m => !selectedMonsters.has(m.name))
      .slice(0, SUGGESTION_LIMIT);
    matches.forEach((m, idx) => {
      const div = document.createElement('div');
      div.textContent = m.name;
      div.dataset.index = idx;
      div.addEventListener('click', () => {
        input.value = m.name;
        clearSuggestions();
        search();
      });
      suggestions.appendChild(div);
    });
  }

  function setActive(items) {
    items.forEach(el => el.classList.remove('active'));
    if (activeIndex >= 0 && items[activeIndex]) {
      items[activeIndex].classList.add('active');
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function search() {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) return;
    const found = monsters.find(m => m.name && m.name.toLowerCase() === q);
    if (!found) { results.innerHTML = '<p>Aucun monstre trouvé</p>'; return; }
    if (selectedMonsters.has(found.name)) { results.innerHTML = `<p>${found.name} déjà sélectionné</p>`; return; }
    selectedMonsters.add(found.name);
    results.appendChild(createCard(found));
    clearSuggestions();
  }

  input.addEventListener('input', updateSuggestions);
  btn.addEventListener('click', () => { clearSuggestions(); search(); });

  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('div');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) { activeIndex = (activeIndex + 1) % items.length; setActive(items); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) { activeIndex = (activeIndex - 1 + items.length) % items.length; setActive(items); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        input.value = items[activeIndex].textContent;
        clearSuggestions();
      }
      search();
    } else if (e.key === 'Escape') {
      clearSuggestions();
    }
  });

  // Click outside to close suggestions
  document.addEventListener('click', (ev) => {
    if (!block.contains(ev.target)) clearSuggestions();
  });
}

// -----------------------
// Multi-search (space-separated names) + multi autocompletion
// -----------------------
function multiSearch() {
  const raw = document.getElementById('multiInput').value.trim();
  const results = document.querySelector('.results-multi');
  results.innerHTML = '';
  if (!raw) return;

  const names = raw.split(/\s+/).map(x => x.trim()).filter(Boolean).slice(0,3);
  names.forEach(n => {
    const lower = n.toLowerCase();
    const found = monsters.find(m => m.name && m.name.toLowerCase() === lower);
    if (!found) {
      results.innerHTML += `<p>Aucun monstre trouvé pour "${n}"</p>`;
      return;
    }
    if (selectedMonsters.has(found.name)) {
      results.innerHTML += `<p>${found.name} déjà sélectionné</p>`;
      return;
    }
    selectedMonsters.add(found.name);
    results.appendChild(createCard(found));
  });
}

// Autocomplete for multiInput (acts on last token only)
(function initMultiAutocomplete(){
  const input = document.getElementById('multiInput');
  const suggestions = document.getElementById('multiSuggestions');
  let activeIndex = -1;

  function clearSuggestions(){ suggestions.innerHTML = ''; activeIndex = -1; }
  function updateSuggestions(){
    const raw = input.value;
    const parts = raw.trim().length ? raw.trim().split(/\s+/) : [];
    const current = parts.length ? parts[parts.length - 1].toLowerCase() : '';
    clearSuggestions();
    if (!current) return;

    const existing = new Set(parts.map(p => p.toLowerCase()));
    const matches = monsters
      .filter(m => m.name && m.name.toLowerCase().includes(current))
      .filter(m => !selectedMonsters.has(m.name) && !existing.has(m.name.toLowerCase()))
      .slice(0, SUGGESTION_LIMIT);

    matches.forEach((m, idx) => {
      const div = document.createElement('div');
      div.textContent = m.name;
      div.dataset.index = idx;
      div.addEventListener('click', () => {
        const nowParts = input.value.trim().split(/\s+/);
        nowParts[nowParts.length - 1] = m.name;
        input.value = nowParts.join(' ');
        clearSuggestions();
      });
      suggestions.appendChild(div);
    });
  }

  function setActive(items){
    items.forEach(el => el.classList.remove('active'));
    if (activeIndex >= 0 && items[activeIndex]) {
      items[activeIndex].classList.add('active');
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  input.addEventListener('input', updateSuggestions);

  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('div');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) { activeIndex = (activeIndex + 1) % items.length; setActive(items); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) { activeIndex = (activeIndex - 1 + items.length) % items.length; setActive(items); }
    } else if (e.key === 'Enter') {
      // If suggestion active, accept it into last token
      if (activeIndex >= 0 && items[activeIndex]) {
        const nowParts = input.value.trim().split(/\s+/);
        nowParts[nowParts.length - 1] = items[activeIndex].textContent;
        input.value = nowParts.join(' ');
        clearSuggestions();
        e.preventDefault();
      }
      // Let Enter trigger multiSearch via handler below
    } else if (e.key === 'Escape') {
      clearSuggestions();
    }
  });

  document.addEventListener('click', (ev) => {
    if (!document.getElementById('multiSearch').contains(ev.target)) clearSuggestions();
  });
})();

// -----------------------
// Initialization
// -----------------------
document.getElementById('multiBtn').addEventListener('click', multiSearch);
document.getElementById('multiInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); multiSearch(); }
});

['search1','search2','search3'].forEach(id => {
  const el = document.getElementById(id);
  if (el) initSearchBlock(el);
});

// Load data last
loadMonsters();
