/**
 * ui.js
 * Module pour gérer la création et la manipulation de l'interface utilisateur.
 */

import { allMonsters, awakenedMonsters, myMonsters, ownedMonsterIds, globalMonsterStats, monsterMetaStats, monsterSynergyStats, teamsData, MAX_STATS } from './main.js';

// Centraliser les sélecteurs DOM pour la performance et la lisibilité
export const searchInput = document.getElementById('searchInput');
export const resultContainer = document.getElementById('result');
export const suggestionsContainer = document.getElementById('suggestions-container');
export const searchBtn = document.getElementById('searchBtn');
export const resetBtn = document.getElementById('resetBtn');
export const bestiaryTabs = document.querySelector('.element-tabs');
export const drawerHandle = document.getElementById('drawer-handle');

/**
 * Crée le HTML pour une seule carte de monstre.
 * @param {object} monsterData - Les données du type de monstre (de bestiary_data.json).
 * @param {object} [unitData=null] - Les données de l'unité spécifique du joueur (de my_bestiary.json).
 * @param {string} [type='carte'] - Le type d'élément à créer ('carte' ou 'fiche').
 * @returns {string} Le HTML de l'élément.
 */
export function createMonsterCard(monsterData, unitData = null, type = 'carte') {
  const { com2us_id, name, element, archetype, max_lvl_hp, max_lvl_attack, max_lvl_defense, speed, crit_rate, crit_damage, resistance, accuracy, image_filename } = monsterData.fields;
  const radialChart = createRadialBarChart(monsterData.fields);
  const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;
  const typeClass = `jarvis-${type}`; // Crée la classe 'jarvis-carte' ou 'jarvis-fiche'

  // Calcul des stats de méta pour ce monstre
  const meta = monsterMetaStats[com2us_id] || {};
  const presenceRate = teamsData.length > 0 ? ((meta.presenceCount || 0) / teamsData.length * 100).toFixed(1) : 0;
  const totalDefUses = (meta.defenseWins || 0) + (meta.defenseLosses || 0);
  const defWinRate = totalDefUses > 0 ? Math.round((meta.defenseWins / totalDefUses) * 100) : 0;
  const totalAtkUses = (meta.attackWins || 0) + (meta.attackLosses || 0);
  const atkWinRate = totalAtkUses > 0 ? Math.round((meta.attackWins / totalAtkUses) * 100) : 0;

  const monsterMetaHtml = `
    <div class="monster-meta-stats">
      <h4 class="monster-meta-title">Statistiques de Méta</h4>
      <p><span>Présence:</span> ${presenceRate}% (${meta.presenceCount || 0} équipes)</p>
      <div class="monster-meta-section">
        <h5>En Défense</h5>
        <p><span>Winrate:</span> ${defWinRate}% (${totalDefUses} combats)</p>
      </div>
      <div class="monster-meta-section">
        <h5>En Attaque</h5>
        <p><span>Winrate:</span> ${atkWinRate}% (${totalAtkUses} combats)</p>
      </div>
    </div>
  `;

  // Calcul et HTML pour les stats de synergie
  const synergy = monsterSynergyStats[com2us_id] || { partners: {}, threats: {}, targets: {} };

  const getTopThree = (statObject) => {
    return Object.entries(statObject)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id, count]) => ({
        monster: allMonsters.find(m => m.fields.com2us_id === parseInt(id)),
        count
      }));
  };

  const createSynergyHtml = (title, monsters) => {
    let html = `<div class="synergy-section"><h5 class="synergy-title">${title}</h5>`;
    if (monsters.length > 0) {
      html += `<div class="synergy-monsters">`;
      monsters.forEach(item => {
        if (item.monster) {
          const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${item.monster.fields.image_filename}`;
          html += `<div class="synergy-monster-item" title="${item.monster.fields.name} (${item.count} fois)"><img src="${imgUrl}" alt="${item.monster.fields.name}"></div>`;
        }
      });
      html += `</div>`;
    } else {
      html += `<p class="no-synergy-data">Pas de données</p>`;
    }
    html += `</div>`;
    return html;
  };

  const synergyHtml = createSynergyHtml('Meilleurs Partenaires', getTopThree(synergy.partners))
                    + createSynergyHtml('Pires Ennemis', getTopThree(synergy.threats))
                    + createSynergyHtml('Cibles Favorites', getTopThree(synergy.targets));

  // HTML pour les stats de base du monstre (colonne 2)
  const baseStatsHtml = `
      <h4 class="fiche-col-title">Stats de Base</h4>
      <p><span>HP:</span> ${max_lvl_hp} | <span>ATK:</span> ${max_lvl_attack}</p>
      <p><span>DEF:</span> ${max_lvl_defense} | <span>SPD:</span> ${speed}</p>
      <p><span>CR:</span> ${crit_rate}% | <span>CD:</span> ${crit_damage}%</p>
      <p><span>RES:</span> ${resistance}% | <span>ACC:</span> ${accuracy}%</p>
  `;

  // HTML pour les stats globales et méta (colonne 3)
  const globalStatsHtml = `
    <div class="rune-stats">
      <p class="rune-stats-title">Stats Moyennes (Tous les monstres)</p>
      <div class="rune-stats-grid">
        <p><span>HP:</span> ${globalMonsterStats.hp.avg}</p>
        <p><span>ATK:</span> ${globalMonsterStats.atk.avg}</p>
        <p><span>DEF:</span> ${globalMonsterStats.def.avg}</p>
        <p><span>SPD:</span> ${globalMonsterStats.spd.avg}</p>
        <p><span>CR:</span> ${globalMonsterStats.cr.avg}%</p>
        <p><span>CD:</span> ${globalMonsterStats.cd.avg}%</p>
        <p><span>RES:</span> ${globalMonsterStats.res.avg}%</p>
        <p><span>ACC:</span> ${globalMonsterStats.acc.avg}%</p>
      </div>
    </div>
  `;

  // Si c'est une 'fiche', on retourne une structure unifiée non-cliquable.
  if (type === 'fiche') {
    return `
      <div class="jarvis-card ${typeClass}" data-monster-name="${name}">
        <div class="remove-btn" data-monster-name="${name}">&times;</div>
        <div class="jarvis-fiche-content">
          <div class="jarvis-fiche-col">
            <div class="jarvis-image-container">
                <img src="${imgUrl}" alt="${name}">
            </div>
            ${radialChart}
            <div class="jarvis-name" style="margin-top: 5px;">${name}</div>
            <p class="fiche-sub-info"><span>Element:</span> ${element} | <span>Archetype:</span> ${archetype}</p>
          </div>
          <div class="jarvis-fiche-col jarvis-stats">${baseStatsHtml}${globalStatsHtml}</div>
          <div class="jarvis-fiche-col">
            ${monsterMetaHtml}
          </div>
          <div class="jarvis-fiche-col">
            ${synergyHtml}
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="jarvis-card ${typeClass}" data-monster-name="${name}">
      <div class="remove-btn" data-monster-name="${name}">&times;</div>
      <div class="jarvis-card-inner">
        <div class="jarvis-card-front">
          <div class="jarvis-content">
              <div class="jarvis-image-container">
                  <img src="${imgUrl}" alt="${name}">
              </div>
              ${radialChart}
              <div class="jarvis-name" style="margin-top: 5px;">${name}</div>
          </div>
        </div>
        <div class="jarvis-card-back">
          <div class="jarvis-stats">
              <div class="jarvis-name" style="margin-bottom: 10px;">${name}</div>${baseStatsHtml}${globalStatsHtml}${monsterMetaHtml}${synergyHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function clearSuggestions() {
  suggestionsContainer.innerHTML = '';
}

export function showResult(html) {
  if (html && html.trim() !== '') {
    resultContainer.style.display = 'block';
  } else {
    resultContainer.style.display = 'none';
  }
  resultContainer.innerHTML = html;
}

export function displayFileVersions(versions) {
  const versionContainer = document.getElementById('version-container');
  if (versionContainer) {
    versionContainer.innerHTML = `
      index: v${versions.index}<br>
      style: v${versions.style}<br>
      script: v${versions.script}
    `;
  }
}

/**
 * Initialise les deux vues du bestiaire (complet et personnel)
 * et la logique de navigation par onglets.
 */
export function initializeBestiaryViews() {
  const monsterListContainer = document.getElementById('monster-list-container');
  if (!monsterListContainer || !bestiaryTabs) return;

  const displayGridForElement = (element) => {
    const monstersToDisplay = awakenedMonsters.filter(m => m.fields.element === element);
    monstersToDisplay.sort((a, b) => {
      const isOwnedA = ownedMonsterIds.has(a.fields.com2us_id) || (a.fields.awakens_from && ownedMonsterIds.has(allMonsters.find(m => m.pk === a.fields.awakens_from)?.fields.com2us_id));
      const isOwnedB = ownedMonsterIds.has(b.fields.com2us_id) || (b.fields.awakens_from && ownedMonsterIds.has(allMonsters.find(m => m.pk === b.fields.awakens_from)?.fields.com2us_id));
      if (isOwnedA !== isOwnedB) return isOwnedA ? -1 : 1;
      return a.pk - b.pk;
    });

    const monsterListHtml = monstersToDisplay.map(monster => {
      const { name, element, image_filename, com2us_id } = monster.fields;
      const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;
      const unawakenedMonster = monster.fields.awakens_from ? allMonsters.find(m => m.pk === monster.fields.awakens_from) : null;
      const unawakenedId = unawakenedMonster ? unawakenedMonster.fields.com2us_id : null;
      const isOwned = ownedMonsterIds.has(com2us_id) || (unawakenedId && ownedMonsterIds.has(unawakenedId));
      const ownedClass = isOwned ? '' : 'not-owned';
      return `<div class="monster-grid-item ${ownedClass}" data-element="${element}" data-name="${name}" title="${name}"><img src="${imgUrl}" alt="${name}" loading="lazy"></div>`;
    }).join('');

    monsterListContainer.innerHTML = `<div class="monster-grid">${monsterListHtml}</div>`;
  };

  bestiaryTabs.addEventListener('click', (e) => {
    if (e.target.matches('.element-tab')) {
      const selectedElement = e.target.dataset.element;
      bestiaryTabs.querySelector('.active').classList.remove('active');
      e.target.classList.add('active');
      displayGridForElement(selectedElement);
    }
  });

  displayGridForElement('fire');

  monsterListContainer.addEventListener('click', (e) => {
    const gridItem = e.target.closest('.monster-grid-item');
    if (gridItem) {
      const monsterName = gridItem.dataset.name.toLowerCase();
      const monsterType = awakenedMonsters.find(m => m.fields.name.toLowerCase() === monsterName);
      if (monsterType) {
        const unawakenedMonster = monsterType.fields.awakens_from ? allMonsters.find(m => m.pk === monsterType.fields.awakens_from) : null;
        const unawakenedId = unawakenedMonster ? unawakenedMonster.fields.com2us_id : null;
        const ownedUnit = myMonsters.find(unit => unit.unit_master_id === monsterType.fields.com2us_id || (unawakenedId && unit.unit_master_id === unawakenedId));
        const cardHtml = createMonsterCard(monsterType, ownedUnit || null, 'fiche'); // On génère une 'fiche' pour la modale
        showMonsterInModal(cardHtml);
      }
    }
  });
}

/**
 * Affiche une carte de monstre dans une modale pop-up.
 * @param {string} cardHtml - Le code HTML de la carte à afficher.
 */
export function showMonsterInModal(cardHtml) {
  let modal = document.getElementById('monster-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'monster-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-content"></div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target.id === 'monster-modal') {
        closeModal();
      }
    });

    modal.addEventListener('click', (e) => {
      const card = e.target.closest('.jarvis-card');
      // On ne retourne que les 'cartes', pas les 'fiches'
      if (card && card.classList.contains('jarvis-carte')) {
        if (e.target.closest('.jarvis-card-front') || e.target.closest('.jarvis-card-back')) {
          card.classList.toggle('is-stats-open');
        }
      }

      // Ajout de la logique pour le bouton de fermeture de la modale
      if (e.target.classList.contains('remove-btn')) {
        closeModal();
      }
    });
  }

  modal.querySelector('.modal-content').innerHTML = cardHtml;
  modal.classList.add('visible');
}

export function closeModal() {
  const modal = document.getElementById('monster-modal');
  if (modal) {
    modal.classList.remove('visible');
  }
}

export function createRadialBarChart(monsterStats) {
  const statsOrder = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  const labels = ['HP', 'ATK', 'DEF', 'SPD', 'CR', 'CD', 'RES', 'ACC'];
  const numStats = statsOrder.length;

  const width = 180;
  const height = 150;
  const center = { x: width / 2, y: height / 2 + 5 };
  const radius = 65;
  const anglePerStat = 360 / numStats;
  const arcPadding = 2;

  const statFieldMap = {
    hp: 'max_lvl_hp', atk: 'max_lvl_attack', def: 'max_lvl_defense', spd: 'speed',
    cr: 'crit_rate', cd: 'crit_damage', res: 'resistance', acc: 'accuracy'
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeSector = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${x},${y} L ${start.x},${start.y} A ${radius},${radius} 0 ${largeArcFlag} 1 ${end.x},${end.y} Z`;
  };

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  let chartHtml = '';
  statsOrder.forEach((stat, i) => {
    const startAngle = i * anglePerStat;
    const endAngle = startAngle + anglePerStat - arcPadding;

    const monsterValue = monsterStats[statFieldMap[stat]];
    const avgValue = globalMonsterStats[stat].avg;
    const maxValue = MAX_STATS[stat];

    const monsterPercentage = monsterValue / maxValue;
    const avgPercentage = avgValue / maxValue;
    
    const monsterRadius = monsterPercentage * radius;
    const avgRadius = avgPercentage * radius;

    chartHtml += `<path class="radial-bar-bg" d="${describeSector(center.x, center.y, radius, startAngle, endAngle)}"></path>`;
    chartHtml += `<path fill="url(#statGradient)" d="${describeSector(center.x, center.y, monsterRadius, startAngle, endAngle)}"></path>`;
    chartHtml += `<path class="avg-marker" d="${describeArc(center.x, center.y, avgRadius, startAngle, endAngle)}"></path>`;

    const labelPoint = polarToCartesian(center.x, center.y, radius + 12, startAngle + (anglePerStat / 2));
    chartHtml += `<text class="label" x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" dominant-baseline="middle">${labels[i]}</text>`;
  });

  return `
    <div class="radial-chart-container">
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
        <defs>
          <radialGradient id="statGradient" cx="${center.x}" cy="${center.y}" r="${radius}" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f44336" />
            <stop offset="50%" stop-color="#ffeb3b" />
            <stop offset="100%" stop-color="#4caf50" />
          </radialGradient>
        </defs>
        ${chartHtml}
      </svg>
    </div>
  `;
}

/**
 * Crée le HTML pour une petite carte de monstre (photo + nom).
 * @param {object} monsterInfo - Les données du monstre depuis allMonsters.
 * @returns {string} Le HTML de la petite carte.
 */
export function createSmallMonsterCard(monsterInfo) {
  if (!monsterInfo) return '';

  const { name, image_filename, com2us_id } = monsterInfo.fields;
  const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;

  const unawakenedMonster = monsterInfo.fields.awakens_from ? allMonsters.find(m => m.pk === monsterInfo.fields.awakens_from) : null;
  const unawakenedId = unawakenedMonster ? unawakenedMonster.fields.com2us_id : null;
  const isOwned = ownedMonsterIds.has(com2us_id) || (unawakenedId && ownedMonsterIds.has(unawakenedId));
  const ownedClass = isOwned ? '' : 'not-owned';

  return `
    <div class="small-monster-card ${ownedClass}" title="Cliquer pour retirer ${name}" data-monster-id="${monsterInfo.fields.com2us_id}">
      <img src="${imgUrl}" alt="${name}">
      <div class="small-monster-name">${name}</div>
    </div>
  `;
}

/**
 * Affiche les équipes "counter" pour une équipe donnée.
 * @param {number[]} monsterIds - Un tableau des com2us_id des 3 monstres de l'équipe.
 * @param {object[]} teamsData - Les données de toutes les équipes.
 * @param {function} openAddCounterModalCallback - La fonction à appeler pour ouvrir la modale.
 * @param {function} switchViewCallback - La fonction pour changer de vue.
 * @param {string} currentView - La vue actuelle ('counters' ou 'counterOf').
 */
export function displayCounterTeams(monsterIds, teamsData, openAddCounterModalCallback, switchViewCallback, currentView) {
  const counterSection = document.getElementById('counter-teams-section');
  const addCounterContainer = document.getElementById('add-counter-container');
  const counterResultContainer = document.getElementById('counter-teams-result');
  
  // On utilise la même logique de recherche que findOrCreateTeam
  // Cette logique est maintenant garantie de trouver une équipe car elle est créée en amont dans searchMonster.
  const leaderId = monsterIds[0];
  const followerIds = [monsterIds[1], monsterIds[2]].sort();

  const foundTeam = teamsData.find(team => {
    if (team.monsters.length !== 3 || team.monsters[0].monster_id !== leaderId) return false;
    const teamFollowerIds = [team.monsters[1].monster_id, team.monsters[2].monster_id].sort();
    return teamFollowerIds[0] === followerIds[0] && teamFollowerIds[1] === followerIds[1];
  });

  // Si l'équipe n'est pas trouvée (ce qui ne devrait plus arriver), on nettoie.
  if (!foundTeam) {
    addCounterContainer.innerHTML = '';
    counterResultContainer.innerHTML = '';
    document.getElementById('defense-stats-container').style.display = 'none';
    document.getElementById('meta-report-container').style.display = 'none';
    counterSection.style.display = 'none';
    return;
  }

  // --- Logique d'affichage (précédemment dans le `if (foundTeam)`) ---

  // On génère et affiche le cadre de statistiques de la défense dans son conteneur dédié (le tiroir).
  const defenseStatsHtml = createTeamStats(foundTeam, teamsData);
  const defenseStatsContainer = document.getElementById('defense-stats-container');
  defenseStatsContainer.innerHTML = defenseStatsHtml;
  defenseStatsContainer.style.display = 'block';

  // On affiche toujours le bouton "Add Counter".
  addCounterContainer.innerHTML = `<button id="add-counter-btn">Add Counter</button>`;
  document.getElementById('add-counter-btn').addEventListener('click', () => openAddCounterModalCallback(foundTeam));

  // Logique pour trouver les équipes que cette défense contre
  const teamsCounteredByThisDef = teamsData.filter(t => t.counter.some(c => c.team_id === foundTeam.team_id));

  let navHtml = '';
  if (teamsCounteredByThisDef.length > 0) {
    navHtml = `
      <div class="counter-view-switcher">
        <button id="show-counters-btn" class="${currentView === 'counters' ? 'active' : ''}">Counters de cette équipe</button>
        <button id="show-counter-of-btn" class="${currentView === 'counterOf' ? 'active' : ''}">Équipes que celle-ci contre</button>
      </div>
    `;
  }

  if (currentView === 'counters') {
    if (foundTeam.counter && foundTeam.counter.length > 0) {
      // On trie les counters par taux de succès (du plus haut au plus bas)
      foundTeam.counter.sort((a, b) => {
        const totalA = a.success + a.failure;
        const rateA = totalA > 0 ? a.success / totalA : -1; // On met les équipes jamais utilisées à la fin
        const totalB = b.success + b.failure;
        const rateB = totalB > 0 ? b.success / totalB : -1;
        return rateB - rateA;
      });

      const counterTeamsHtml = foundTeam.counter.map(counterInfo => {
        const counterTeamData = teamsData.find(t => t.team_id === counterInfo.team_id);
        return counterTeamData ? createTeamCard(counterTeamData, counterInfo) : '';
      }).join('');
      counterResultContainer.innerHTML = navHtml + counterTeamsHtml;
    } else {
      counterResultContainer.innerHTML = navHtml + `<p>Aucun counter trouvé pour cette équipe.</p>`;
    }
  } else {
    const teamsHtml = teamsCounteredByThisDef.map(team => createTeamCard(team, null)).join('');
    counterResultContainer.innerHTML = navHtml + teamsHtml;
  }

  // Ajout des listeners sur les boutons de navigation s'ils existent
  const showCountersBtn = document.getElementById('show-counters-btn');
  const showCounterOfBtn = document.getElementById('show-counter-of-btn');
  if (showCountersBtn && showCounterOfBtn) {
    showCountersBtn.addEventListener('click', () => switchViewCallback('counters'));
    showCounterOfBtn.addEventListener('click', () => switchViewCallback('counterOf'));
  }
  counterSection.style.display = 'block';
}

/**
 * Calcule les statistiques de performance brutes d'une équipe (défense et attaque).
 * @param {object} teamData - Les données de l'équipe.
 * @param {object[]} allTeamsData - Toutes les données des équipes pour calculer les stats d'attaque.
 * @returns {object} Un objet contenant les statistiques de performance.
 */
export function getTeamPerformanceStats(teamData, allTeamsData) {
  // Stats en tant que défense
  const defenseAttacks = teamData.counter.reduce((acc, c) => acc + c.success + c.failure, 0);
  const defenseWins = teamData.counter.reduce((acc, c) => acc + c.failure, 0);
  const defenseWinRate = defenseAttacks > 0 ? Math.round((defenseWins / defenseAttacks) * 100) : 0;
  const knownCounters = teamData.counter.length;

  // Stats en tant que counter (attaque)
  let attackUses = 0;
  let attackWins = 0;
  allTeamsData.forEach(t => {
    const counterInstance = t.counter.find(c => c.team_id === teamData.team_id);
    if (counterInstance) {
      attackUses += counterInstance.success + counterInstance.failure;
      attackWins += counterInstance.success;
    }
  });
  const attackSuccessRate = attackUses > 0 ? Math.round((attackWins / attackUses) * 100) : 0;

  return {
    defenseAttacks, defenseWins, defenseWinRate, knownCounters,
    attackUses, attackWins, attackSuccessRate
  };
}

/**
 * Crée le HTML pour le cadre de statistiques d'une équipe.
 * @param {object} teamData - Les données de l'équipe.
 * @param {object[]} allTeamsData - Toutes les données des équipes pour calculer les stats d'attaque.
 * @returns {string} Le HTML du cadre de statistiques.
 */
export function createTeamStats(teamData, allTeamsData) {
  // Stats en tant que défense
  const stats = getTeamPerformanceStats(teamData, allTeamsData);

  return `
    <div class="defense-stats-card">
      <h3 class="section-title" style="margin-top: 0;">Stats de la Défense</h3>
      <div class="team-stats-container">
        <div class="team-stats-section">
          <div class="stats-title">Performance en Défense</div>
          <p>Attaques subies: <span>${stats.defenseAttacks}</span></p>
          <p>Victoires: <span>${stats.defenseWins} (${stats.defenseWinRate}%)</span></p>
          <p>Counters connus: <span>${stats.knownCounters}</span></p>
        </div>
        <div class="team-stats-section">
          <div class="stats-title">Performance en Attaque</div>
          <p>Utilisations: <span>${stats.attackUses}</span></p>
          <p>Succès: <span>${stats.attackWins} (${stats.attackSuccessRate}%)</span></p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Crée le HTML pour une carte d'équipe.
 * @param {object} teamData - Les données de l'équipe depuis teams.json.
 * @param {object} [counterInfo=null] - Les informations de counter (win/loss).
 * @returns {string} Le HTML de la carte d'équipe.
 */
export function createTeamCard(teamData, counterInfo = null) {
  const monsterImagesHtml = teamData.monsters.map(monster => {
    const monsterInfo = allMonsters.find(m => m.fields.com2us_id === monster.monster_id);
    return createSmallMonsterCard(monsterInfo);
  }).join('');

  let counterStatsHtml = '';
  if (counterInfo) {
    const total = counterInfo.success + counterInfo.failure;
    const winRate = total > 0 ? Math.round((counterInfo.success / total) * 100) : 0;

    counterStatsHtml = `
      <div class="team-counter-stats">
        <div class="win-rate">${winRate}%</div>
        <div class="win-loss-details"><span>Win: ${counterInfo.success}</span> | <span>Loss: ${counterInfo.failure}</span></div>
      </div>
      <div class="team-counter-actions">
        <button class="win-btn" data-counter-team-id="${teamData.team_id}" data-defense-team-id="${counterInfo.defense_team_id || ''}">Win</button>
        <button class="loss-btn" data-counter-team-id="${teamData.team_id}" data-defense-team-id="${counterInfo.defense_team_id || ''}">Loss</button>
      </div>
    `;
  }

  return `
    <div class="team-card" data-team-id="${teamData.team_id}">
      <div class="delete-team-btn" title="Supprimer cette équipe">&times;</div>
      <div class="team-card-main">
        <div class="team-monsters">${monsterImagesHtml}</div>
        ${counterStatsHtml}
      </div>
      <div class="team-notes">
        <p>${teamData.notes}</p>
      </div>
    </div>
  `;
}

/**
 * Ouvre une modale pour ajouter une nouvelle équipe "counter".
 * @param {object[]} defenseMonsters - Un tableau des 3 objets monstres de la défense.
 * @param {function} onConfirm - Callback à exécuter lors de la confirmation.
 * @param {function} strNoAccent - La fonction utilitaire pour normaliser les chaînes.
 */
export function openAddCounterModal(defenseMonsters, onConfirm, strNoAccent) {
  let modal = document.getElementById('add-counter-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'add-counter-modal';
  modal.className = 'modal-overlay';

  const defensePreviewHtml = defenseMonsters.map(monster => 
    `<img src="https://swarfarm.com/static/herders/images/monsters/${monster.fields.image_filename}" title="${monster.fields.name}">`
  ).join('');

  modal.innerHTML = `
    <div class="add-counter-modal-content">
      <div class="add-counter-modal-header">
        <h3>Ajouter un Counter pour :</h3>
        <div class="defense-team-preview">${defensePreviewHtml}</div>
      </div>
      <div class="add-counter-modal-body">
        <div class="search-container">
          <input type="text" id="counter-search-input" placeholder="Chercher les monstres du counter..." autocomplete="off">
          <div id="counter-suggestions-container"></div>
        </div>
        <div class="selected-counter-preview"></div>
      </div>
      <div class="add-counter-modal-footer">
        <button id="cancel-add-counter">Annuler</button>
        <button id="confirm-add-counter">Add</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('visible');

  const counterSearchInput = document.getElementById('counter-search-input');
  const selectedPreview = modal.querySelector('.selected-counter-preview');
  const confirmButton = modal.querySelector('#confirm-add-counter');
  let selectedCounterMonsters = [];

  counterSearchInput.addEventListener('input', () => {
    const query = counterSearchInput.value.trim().toLowerCase();
    const suggestionsContainer = document.getElementById('counter-suggestions-container');
    if (query.length < 2) {
      suggestionsContainer.innerHTML = '';
      return;
    }
    const selectedIds = new Set(selectedCounterMonsters.map(m => m.fields.com2us_id));
    const suggestions = allMonsters
      .filter(m => m.fields.is_awakened && !selectedIds.has(m.fields.com2us_id) && strNoAccent(m.fields.name.toLowerCase()).includes(strNoAccent(query)))
      .slice(0, 5);

    suggestionsContainer.innerHTML = suggestions.map(s => 
      `<div class="suggestion-item" data-monster-id="${s.fields.com2us_id}">${s.fields.name}</div>`
    ).join('');
  });

  modal.querySelector('#counter-suggestions-container').addEventListener('click', e => {
    if (e.target.classList.contains('suggestion-item') && selectedCounterMonsters.length < 3) { 
      const monsterId = parseInt(e.target.dataset.monsterId, 10);
      const monsterInfo = allMonsters.find(m => m.fields.com2us_id === monsterId);
      const isAlreadySelected = selectedCounterMonsters.some(m => m.fields.com2us_id === monsterId);
      if (monsterInfo && !isAlreadySelected) {
        selectedCounterMonsters.push(monsterInfo);
        updateCounterPreview();
        counterSearchInput.value = '';
        document.getElementById('counter-suggestions-container').innerHTML = '';
        counterSearchInput.focus();
      }
    }
  });

  selectedPreview.addEventListener('click', e => {
    const cardToRemove = e.target.closest('.small-monster-card');
    if (cardToRemove) {
      const monsterIdToRemove = parseInt(cardToRemove.dataset.monsterId, 10);
      selectedCounterMonsters = selectedCounterMonsters.filter(m => m.fields.com2us_id !== monsterIdToRemove);
      updateCounterPreview();
    }
  });

  function updateCounterPreview() {
    selectedPreview.innerHTML = selectedCounterMonsters.map(m => createSmallMonsterCard(m)).join('');
    updateAddButtonState();
  }

  function updateAddButtonState() {
    confirmButton.disabled = selectedCounterMonsters.length !== 3;
  }

  updateAddButtonState();
  modal.querySelector('#cancel-add-counter').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => {
    if (e.target.id === 'add-counter-modal') modal.remove();
  });

  confirmButton.addEventListener('click', () => {
    onConfirm(selectedCounterMonsters);
    modal.remove();
  });
}

/**
 * Ferme le tiroir du bestiaire s'il est ouvert.
 */
export function closeBestiaryDrawer() {
  const drawer = document.getElementById('bestiary-section');
  if (drawer && drawer.classList.contains('is-open')) {
    drawer.classList.remove('is-open');
    drawerHandle.textContent = '›';
  }
}
