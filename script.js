const APP_VERSION = "5.2";
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`;
});

const CSS_VERSION = "5.2";
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("cssVersionLabel").textContent = `CSS v${CSS_VERSION}`;
});

const SCRIPT_VERSION = "5.2";
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`;
});

let monsters = [];
let averages = {};
let statsRange = {};
const SUGGESTION_LIMIT = 5;
const selectedMonsters = new Set();

// =======================
// Chargement et calculs
// =======================
async function loadMonsters() {
  try {
    const res = await fetch('bestiary_data.json');
    const raw = await res.json();

    // âœ… extraction des champs "fields"
    monsters = raw.map(m => m.fields);

    console.log(`âœ… Monster Search chargÃ© avec ${monsters.length} monstres.`);

    const total = { hp:0, atk:0, def:0, spd:0 };
    const min = { hp:Infinity, atk:Infinity, def:Infinity, spd:Infinity };
    const max = { hp:-Infinity, atk:-Infinity, def:-Infinity, spd:-Infinity };
    let count = 0;

    monsters
      .filter(m => m.base_stars === 6 && m.is_awakened === true)
      .forEach(m => {
        const hp = Number(m.max_lvl_hp) || 0;
        const atk = Number(m.max_lvl_attack) || 0;
        const def = Number(m.max_lvl_defense) || 0;
        const spd = Number(m.speed) || 0;

        if (hp && atk && def && spd) {
          total.hp += hp;
          total.atk += atk;
          total.def += def;
          total.spd += spd;

          min.hp = Math.min(min.hp, hp);
          min.atk = Math.min(min.atk, atk);
          min.def = Math.min(min.def, def);
          min.spd = Math.min(min.spd, spd);

          max.hp = Math.max(max.hp, hp);
          max.atk = Math.max(max.atk, atk);
          max.def = Math.max(max.def, def);
          max.spd = Math.max(max.spd, spd);

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
    console.log("Moyennes calculÃ©es (6* Ã©veillÃ©s) :", averages);
    console.log("Bornes min/max :", statsRange);

  } catch (err) {
    console.error("Erreur chargement bestiary_data.json :", err);
  }
}

// =======================
// Affichage des stats
// =======================
function renderStat(label, value, avg, min, max) {
  if (!value) return "";
  const percent = ((value - min) / (max - min)) * 100;
  const avgPercent = ((avg - min) / (max - min)) * 100;
  const color = value >= avg ? "green" : "red";
  return `
    <div class="stat">
      <span><strong>${label} :</strong> ${value}</span>
      <div class="progress-bar">
        <div class="progress ${color}" style="width:${percent}%"></div>
        <div class="avg-marker" style="left:${avgPercent}%"></div>
      </div>
      <small>min:${min} | moy:${avg} | max:${max}</small>
    </div>`;
}

function createCard(monster) {
  const imgUrl = monster.image_filename ? 
    `https://swarfarm.com/static/herders/images/monsters/${monster.image_filename}` : "";
  const elemIconUrl = monster.element ? `icons/${monster.element.toLowerCase()}.png` : "";
  const card = document.createElement('div');
  card.className = 'card fade-in';
  card.innerHTML = `
    <img class="monster" src="${imgUrl}" alt="${monster.name}">
    <h3>${monster.name}</h3>
    <p>
      ${elemIconUrl ? `<img class="icon" src="${elemIconUrl}" alt="${monster.element}">` : ""}
      <span class="small">${monster.element || "â€""}</span><br>
      <span class="small">Archetype: ${monster.archetype || "â€""}</span>
    </p>
    <div class="stat-grid">
      ${renderStat("HP", monster.max_lvl_hp, averages.hp, statsRange.min.hp, statsRange.max.hp)}
      ${renderStat("ATK", monster.max_lvl_attack, averages.atk, statsRange.min.atk, statsRange.max.atk)}
      ${renderStat("DEF", monster.max_lvl_defense, averages.def, statsRange.min.def, statsRange.max.def)}
      ${renderStat("Vitesse", monster.speed, averages.spd, statsRange.min.spd, statsRange.max.spd)}
    </div>
  `;
  return card;
}

// =======================
// Recherche simple
// =======================
function initSearchBlock(id) {
  const block = document.getElementById(id);
  const input = block.querySelector("input");
  const btn = block.querySelector("button");
  const results = block.querySelector(".results");
  const suggestions = block.querySelector(".suggestions");

  function doSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    const found = monsters.find(m => m.base_stars === 6 && m.is_awakened === true && m.name && m.name.toLowerCase().includes(q));
    results.innerHTML = "";

    if (found) {
      results.appendChild(createCard(found));
    }
  }

  btn.addEventListener("click", doSearch);
  input.addEventListener("keypress", e => { if (e.key === "Enter") doSearch(); });

  autocomplete(input, suggestions, false);
}

// =======================
// MultiSearch (3 noms)
// =======================
function initMultiSearch() {
  const input = document.getElementById("multiInput");
  const btn = document.getElementById("multiBtn");
  const results = document.querySelector(".results-multi");
  const suggestions = document.getElementById("multiSuggestions");

  function doSearch() {
    const names = input.value.trim().toLowerCase().split(/\s+/);
    results.innerHTML = "";

    names.forEach(n => {
      if (!n) return;
      const found = monsters.find(m => m.base_stars === 6 && m.is_awakened === true && m.name && m.name.toLowerCase().includes(n));
      if (found) {
        results.appendChild(createCard(found));
      }
    });
  }

  btn.addEventListener("click", doSearch);
  input.addEventListener("keypress", e => { if (e.key === "Enter") doSearch(); });

  autocomplete(input, suggestions, true);
}

// =======================
// AutocomplÃ©tion
// =======================
function autocomplete(input, suggestionsBox, isMulti) {
  let currentIndex = -1;

  input.addEventListener("input", () => {
    const val = input.value.toLowerCase();
    suggestionsBox.innerHTML = "";
    if (!val) return;

    const lastWord = isMulti ? val.split(/\s+/).pop() : val;
    if (!lastWord) return;

    const matches = monsters
      .filter(m =>
        m.base_stars === 6 &&
        m.is_awakened === true &&
        m.name &&
        m.name.toLowerCase().includes(lastWord)
      )
      .slice(0, SUGGESTION_LIMIT);

    matches.forEach(m => {
      const div = document.createElement("div");
      div.className = "suggestion";
      div.textContent = m.name;
      div.addEventListener("click", () => {
        if (isMulti) {
          const parts = input.value.trim().split(/\s+/);
          parts.pop();
          parts.push(m.name);
          input.value = parts.join(" ") + " ";
        } else {
          input.value = m.name;
        }
        suggestionsBox.innerHTML = "";
      });
      suggestionsBox.appendChild(div);
    });
  });

  input.addEventListener("keydown", e => {
    const items = suggestionsBox.querySelectorAll(".suggestion");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      currentIndex = (currentIndex + 1) % items.length;
      items.forEach(el => el.classList.remove("active"));
      items[currentIndex].classList.add("active");
    } else if (e.key === "ArrowUp") {
      currentIndex = (currentIndex - 1 + items.length) % items.length;
      items.forEach(el => el.classList.remove("active"));
      items[currentIndex].classList.add("active");
    } else if (e.key === "Enter" && currentIndex >= 0) {
      e.preventDefault();
      items[currentIndex].click();
      currentIndex = -1;
    }
  });
}

// =======================
// Bouton Reset
// =======================
function initReset() {
  const resetBtn = document.getElementById("resetBtn");
  if (!resetBtn) return;
  resetBtn.addEventListener("click", () => {
    selectedMonsters.clear();
    document.querySelectorAll("input").forEach(i => i.value = "");
    document.querySelectorAll(".results, .results-multi").forEach(r => r.innerHTML = "");
  });
}

// =======================
// Initialisation
// =======================
document.addEventListener('DOMContentLoaded', function() {
  loadMonsters().then(() => {
    initSearchBlock("search1");
    initSearchBlock("search2");
    initSearchBlock("search3");
    initMultiSearch();
    initReset();
  });
});
