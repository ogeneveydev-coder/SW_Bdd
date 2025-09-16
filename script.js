const APP_VERSION = "2.7";
document.getElementById("versionLabel").textContent = `Version ${APP_VERSION}`;
let monsters = [];
const SUGGESTION_LIMIT = 5;
const selectedMonsters = new Set();

async function loadMonsters() {
  try {
    const res = await fetch('monsters_sw.json');
    monsters = await res.json();
    console.log(`✅ Monster Search v${APP_VERSION} chargé avec ${monsters.length} monstres.`);
  } catch (err) {
    console.error('Erreur chargement monsters_sw.json :', err);
  }
}

function initSearchBlock(block) {
  const input = block.querySelector("input");
  const btn = block.querySelector("button");
  const suggestions = block.querySelector(".suggestions");
  const results = block.querySelector(".results");
  let activeIndex = -1;

  function clearSuggestions() { suggestions.innerHTML = ""; activeIndex = -1; }
  function updateSuggestions() {
    const q = input.value.trim().toLowerCase();
    clearSuggestions();
    if (!q) return;
    const matches = monsters
      .filter(m => m.name && m.name.toLowerCase().includes(q))
      .filter(m => !selectedMonsters.has(m.name))
      .slice(0, SUGGESTION_LIMIT);
    matches.forEach((m, idx) => {
      const div = document.createElement("div");
      div.textContent = m.name;
      div.dataset.index = idx;
      div.addEventListener("click", () => { input.value = m.name; clearSuggestions(); search(); });
      suggestions.appendChild(div);
    });
  }
  function setActive(items) {
    items.forEach(el => el.classList.remove('active'));
    if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].classList.add('active');
  }
  function search() {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = "";
    if (!q) return;
    const found = monsters.filter(m => m.name && m.name.toLowerCase() === q);
    if (found.length === 0) { results.innerHTML = `<p>Aucun monstre trouvé</p>`; return; }
    const monster = found[0];
    selectedMonsters.add(monster.name);
    const imgUrl = monster.image_filename ? `https://swarfarm.com/static/herders/images/monsters/${monster.image_filename}` : "";
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
        <div><strong>Étoiles :</strong> ${monster.base_stars || "–"}</div>
        <div><strong>HP :</strong> ${monster.max_lvl_hp || monster.base_hp || "–"}</div>
        <div><strong>ATK :</strong> ${monster.max_lvl_attack || monster.base_attack || "–"}</div>
        <div><strong>DEF :</strong> ${monster.max_lvl_defense || monster.base_defense || "–"}</div>
        <div><strong>Vitesse :</strong> ${monster.speed || "–"}</div>
      </div>
    `;
    results.appendChild(card);
  }
  input.addEventListener("input", updateSuggestions);
  btn.addEventListener("click", () => { clearSuggestions(); search(); });
  input.addEventListener("keydown", (e) => {
    const items = suggestions.querySelectorAll("div");
    if (e.key === "ArrowDown") { e.preventDefault(); if (items.length > 0) { activeIndex = (activeIndex + 1) % items.length; setActive(items); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (items.length > 0) { activeIndex = (activeIndex - 1 + items.length) % items.length; setActive(items); } }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIndex >= 0 && items[activeIndex]) { input.value = items[activeIndex].textContent; clearSuggestions(); } search(); }
    else if (e.key === "Escape") { clearSuggestions(); }
  });
  document.addEventListener("click", (ev) => { if (!block.contains(ev.target)) clearSuggestions(); });
}

["search1","search2","search3"].forEach(id => initSearchBlock(document.getElementById(id)));
loadMonsters();