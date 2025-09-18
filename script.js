/* script_v41.js - uniquement multiInput + reset + autocomplétion */

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

function createCard(monster) {
  const wrapper = document.createElement('div');
  wrapper.className = 'card';

  const img = document.createElement('img');
  img.className = 'monster';
  if (monster.image_filename) img.src = `https://swarfarm.com/static/herders/images/monsters/${monster.image_filename}`;
  img.alt = monster.name || 'monster';

  const title = document.createElement('h3');
  title.textContent = monster.name || '—';

  const meta = document.createElement('p');
  meta.innerHTML = `${monster.element ? `<img class="icon" src="icons/${monster.element.toLowerCase()}.png" alt="${monster.element}">` : ''} 
  ${monster.element||'–'} • Archetype: ${monster.archetype||'–'}`;

  const statsText = document.createElement('div');
  statsText.className = 'stats';
  statsText.innerHTML = `
    <div>HP: ${monster.max_lvl_hp}</div>
    <div>ATK: ${monster.max_lvl_attack}</div>
    <div>DEF: ${monster.max_lvl_defense}</div>
    <div>SPD: ${monster.speed}</div>`;

  wrapper.appendChild(img);
  wrapper.appendChild(title);
  wrapper.appendChild(meta);
  wrapper.appendChild(statsText);
  return wrapper;
}

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

  // Autocomplétion
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
    document.getElementById("multiInput").value = "";
    document.querySelector(".results-multi").innerHTML = "";
    const suggestions = document.getElementById("multiSuggestions"); if (suggestions) suggestions.innerHTML = "";
  });
}

loadMonsters().then(() => { initMultiSearch(); initReset(); });
