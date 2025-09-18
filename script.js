const APP_VERSION = "2.9";
document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`;

const CSS_VERSION = "3.6";
document.getElementById("cssVersionLabel").textContent = `CSS v${CSS_VERSION}`;

const SCRIPT_VERSION = "3.8";
document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`;

let monsters = [];
let averages = {};
let statsRange = {};
const SUGGESTION_LIMIT = 5;
const selectedMonsters = new Set();

async function loadMonsters() {
  try {
    const res = await fetch('monsters_sw.json');
    monsters = await res.json();
    console.log(`✅ Monster Search chargé avec ${monsters.length} monstres.`);

    const total = { hp:0, atk:0, def:0, spd:0, stars:0 };
    const min = { hp:Infinity, atk:Infinity, def:Infinity, spd:Infinity, stars:Infinity };
    const max = { hp:-Infinity, atk:-Infinity, def:-Infinity, spd:-Infinity, stars:-Infinity };
    let count = 0;

    monsters.forEach(m => {
      if (m.base_stars && m.max_lvl_hp && m.max_lvl_attack && m.max_lvl_defense && m.speed) {
        total.stars += m.base_stars;
        total.hp += m.max_lvl_hp;
        total.atk += m.max_lvl_attack;
        total.def += m.max_lvl_defense;
        total.spd += m.speed;

        min.stars = Math.min(min.stars, m.base_stars);
        min.hp = Math.min(min.hp, m.max_lvl_hp);
        min.atk = Math.min(min.atk, m.max_lvl_attack);
        min.def = Math.min(min.def, m.max_lvl_defense);
        min.spd = Math.min(min.spd, m.speed);

        max.stars = Math.max(max.stars, m.base_stars);
        max.hp = Math.max(max.hp, m.max_lvl_hp);
        max.atk = Math.max(max.atk, m.max_lvl_attack);
        max.def = Math.max(max.def, m.max_lvl_defense);
        max.spd = Math.max(max.spd, m.speed);

        count++;
      }
    });

    averages = {
      stars: (total.stars / count).toFixed(1),
      hp: Math.round(total.hp / count),
      atk: Math.round(total.atk / count),
      def: Math.round(total.def / count),
      spd: Math.round(total.spd / count)
    };

    statsRange = { min, max };
    console.log("Moyennes calculées :", averages);
    console.log("Bornes min/max :", statsRange);

  } catch (err) {
    console.error("Erreur chargement monsters_sw.json :", err);
  }
}

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
      <span class="small">${monster.element || "–"}</span>
    </p>
    <div class="stat-grid">
      ${renderStat("Étoiles", monster.base_stars, averages.stars, statsRange.min.stars, statsRange.max.stars)}
      ${renderStat("HP", monster.max_lvl_hp, averages.hp, statsRange.min.hp, statsRange.max.hp)}
      ${renderStat("ATK", monster.max_lvl_attack, averages.atk, statsRange.min.atk, statsRange.max.atk)}
      ${renderStat("DEF", monster.max_lvl_defense, averages.def, statsRange.min.def, statsRange.max.def)}
      ${renderStat("Vitesse", monster.speed, averages.spd, statsRange.min.spd, statsRange.max.spd)}
    </div>
  `;
  return card;
}

// TODO: reste initSearchBlock, multiSearch identiques à v3.7 mais utilisant createCard()
// (par souci de place ici on ne recolle pas l'intégralité mais l'idée est :
// au lieu de card.innerHTML = ..., on fait results.appendChild(createCard(monster)) )

loadMonsters();