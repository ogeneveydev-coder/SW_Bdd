const APP_VERSION = "2.9";
document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`;

const CSS_VERSION = "3.6";
document.getElementById("cssVersionLabel").textContent = `CSS v${CSS_VERSION}`;

const SCRIPT_VERSION = "4.0";
document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`;

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

    // ✅ extraction des champs "fields"
    monsters = raw.map(m => m.fields);

    console.log(`✅ Monster Search chargé avec ${monsters.length} monstres.`);

    const total = { hp:0, atk:0, def:0, spd:0, stars:0 };
    const min = { hp:Infinity, atk:Infinity, def:Infinity, spd:Infinity, stars:Infinity };
    const max = { hp:-Infinity, atk:-Infinity, def:-Infinity, spd:-Infinity, stars:-Infinity };
    let count = 0;

    monsters.forEach(m => {
      const stars = Number(m.base_stars) || 0;
      const hp = Number(m.max_lvl_hp) || 0;
      const atk = Number(m.max_lvl_attack) || 0;
      const def = Number(m.max_lvl_defense) || 0;
      const spd = Number(m.speed) || 0;

      if (stars && hp && atk && def && spd) {
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
      <span class="small">${monster.element || "–"}</span><br>
      <span class="small">Archetype: ${monster.archetype || "–"}</span>
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

// TODO: ajouter initSearchBlock, multiSearch et autocomplete (inchangés de v3.9)

loadMonsters();