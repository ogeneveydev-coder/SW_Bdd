/* tada*/

// --- GESTION DES VERSIONS ---
// Mettez à jour ces valeurs lorsque vous modifiez un fichier.
const fileVersions = {
  script: '2.30',
  style: '2.26',
  index: '2.7'
};
const allMonsters = []; // Contiendra TOUS les monstres (éveillés et non-éveillés) pour la recherche
let awakenedMonsters = []; // Ne contiendra que les monstres éveillés pour l'affichage
let myMonsters = []; // Stockera les monstres du joueur
let ownedMonsterIds = new Set(); // Stockera les IDs des monstres possédés pour une recherche rapide
let globalMonsterStats = {}; // Stockera les stats min/avg/max de tous les monstres

// Valeurs maximales de référence pour calculer les pourcentages des anneaux
const MAX_STATS = { 
  hp: 20000, atk: 1000, def: 1000, spd: 135,
  cr: 100, cd: 100, res: 100, acc: 100
};

// Centraliser les sélecteurs DOM pour la performance et la lisibilité
const searchInput = document.getElementById('searchInput');
const resultContainer = document.getElementById('result');
const suggestionsContainer = document.getElementById('suggestions-container');
const searchBtn = document.getElementById('searchBtn');
const resetBtn = document.getElementById('resetBtn');

// Charger les données une seule fois au démarrage
window.addEventListener('DOMContentLoaded', () => {
  displayFileVersions(); // Affiche les versions au chargement

  // Utilisation de Promise.all pour charger les deux fichiers en parallèle
  Promise.all([
    fetch('bestiary_data.json').then(res => res.json()),
    fetch('my_bestiary.json').then(res => res.json()).catch(err => {
      console.warn("Fichier my_bestiary.json non trouvé ou invalide. La section 'Mes Monstres' sera vide.", err);
      return null; // Retourne null si le fichier n'existe pas pour ne pas bloquer le reste
    })
  ])
    .then(([bestiaryData, myBestiaryData]) => {
      // 1. On charge TOUS les monstres 2-6 étoiles dans allMonsters pour la recherche
      const allRelevantMonsters = bestiaryData.filter(obj => obj.model === "bestiary.monster" && obj.fields.natural_stars >= 2);
      allMonsters.push(...allRelevantMonsters);

      // 2. On ne garde que les monstres ÉVEILLÉS dans awakenedMonsters pour l'affichage des grilles et la recherche de type
      awakenedMonsters = allMonsters.filter(m => m.fields.is_awakened);

      if (myBestiaryData && myBestiaryData.unit_list) {
        myMonsters = myBestiaryData.unit_list;
        ownedMonsterIds = new Set(myMonsters.map(m => m.unit_master_id));
      }

      // Pré-calcule les statistiques globales sur tous les monstres filtrés
      const stats = {
        hp:  awakenedMonsters.map(m => m.fields.max_lvl_hp),
        atk: awakenedMonsters.map(m => m.fields.max_lvl_attack),
        def: awakenedMonsters.map(m => m.fields.max_lvl_defense),
        spd: awakenedMonsters.map(m => m.fields.speed),
        cr:  awakenedMonsters.map(m => m.fields.crit_rate),
        cd:  awakenedMonsters.map(m => m.fields.crit_damage),
        res: awakenedMonsters.map(m => m.fields.resistance),
        acc: awakenedMonsters.map(m => m.fields.accuracy),
      };
      const calc = (arr) => ({
        min: Math.min(...arr),
        max: Math.max(...arr),
        avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
      });
      globalMonsterStats = {
        hp:  calc(stats.hp),
        atk: calc(stats.atk),
        def: calc(stats.def),
        spd: calc(stats.spd),
        cr:  calc(stats.cr),
        cd:  calc(stats.cd),
        res: calc(stats.res),
        acc: calc(stats.acc),
      };

      // Une fois les données chargées, on génère le bestiaire complet
      initializeBestiaryViews();

    })
    .catch(err => {
      console.error("Erreur lors du chargement des données du bestiaire.", err);
      showResult("Impossible de charger les données des monstres.");
    });

});

searchBtn.addEventListener('click', () => searchMonsterFromInput());
resetBtn.addEventListener('click', resetSearch);

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // Empêche le rechargement de la page
    clearSuggestions();
    searchMonsterFromInput();
  } else if (e.key === 'Escape') {
    resetSearch(); // Utilise resetSearch pour tout effacer
  }
});

function searchMonster(unitId = null) {
  const query = unitId ? '' : searchInput.value.trim();
  const isSearchById = unitId !== null;

  if (!isSearchById && !query) {
    showResult("Veuillez entrer le nom d'un ou plusieurs monstres.");
    return;
  }

  if (isSearchById) {
    const specificMonster = myMonsters.find(m => m.unit_id === unitId);
    if (!specificMonster) return;

    // CORRECTION : Gérer les monstres non-éveillés
    // 1. Trouver le type de base du monstre (peut être non-éveillé)
    let monsterType = allMonsters.find(m => m.fields.com2us_id === specificMonster.unit_master_id);
    if (!monsterType) return; // Si même le type de base n'est pas trouvé, on arrête.

    // 2. Si le monstre n'est pas éveillé, trouver sa forme éveillée
    if (!monsterType.fields.is_awakened && monsterType.fields.awakens_to) {
      monsterType = allMonsters.find(m => m.pk === monsterType.fields.awakens_to) || monsterType;
    }
    
    if (monsterType) { // On a maintenant la bonne forme (éveillée) à afficher
      const cardHtml = createMonsterCard(monsterType, specificMonster);
      showMonsterInModal(cardHtml); // Affiche dans la modale
    }
    return;
  }

  // --- Recherche par nom (comportement existant) ---
  const searchTerms = [...new Set(query.split(' ').map(term => strNoAccent(term.trim().toLowerCase())).filter(Boolean))];
  const foundMonsters = [];
  const foundAwakenedPks = new Set();

  // Pour chaque terme de recherche, on trouve les monstres correspondants
  searchTerms.forEach(term => {
    allMonsters.forEach(monster => {
      const monsterName = strNoAccent(monster.fields.name.toLowerCase());
      // Si le terme de recherche correspond exactement au nom d'un monstre
      if (monsterName === term) {
      let monsterToShow = monster;

      // Si le monstre trouvé n'est pas éveillé, on récupère sa version éveillée
      if (!monster.fields.is_awakened && monster.fields.awakens_to) {
        const awakenedVersion = allMonsters.find(m => m.pk === monster.fields.awakens_to);
        if (awakenedVersion) monsterToShow = awakenedVersion;
      }

      // On ajoute le monstre à la liste des résultats s'il n'y est pas déjà
      if (monsterToShow && !foundAwakenedPks.has(monsterToShow.pk)) {
        foundMonsters.push(monsterToShow);
        foundAwakenedPks.add(monsterToShow.pk);
      }
      }
    });
  });

  if (foundMonsters.length === 0) {
    showResult("Aucun des monstres recherchés n'a été trouvé.");
    return;
  }

  // Construit une carte HTML pour chaque monstre trouvé
  const cardsHtml = foundMonsters.map(monster => createMonsterCard(monster)).join('');

  // Affiche les cartes dans un conteneur
  showResult(`<div class="results-container">${cardsHtml}</div>`);
}

function searchMonsterFromInput() {
  // Cette fonction est maintenant dédiée à la recherche depuis la barre de recherche
  searchMonster();
}

/**
 * Crée le HTML pour une seule carte de monstre.
 * @param {object} monsterData - Les données du type de monstre (de bestiary_data.json).
 * @param {object} [unitData=null] - Les données de l'unité spécifique du joueur (de my_bestiary.json).
 * @returns {string} Le HTML de la carte.
 */
function createMonsterCard(monsterData, unitData = null) {
  // CORRECTION : Utiliser les stats max (lvl 40) au lieu des stats de base
  const { name, element, archetype, max_lvl_hp, max_lvl_attack, max_lvl_defense, speed, crit_rate, crit_damage, resistance, accuracy, image_filename } = monsterData.fields;
  const radialChart = createRadialBarChart(monsterData.fields);
  const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;

  let statsDisplayHtml;
  let runeSetsHtml = '';

  if (unitData) {
    // On ne traite les runes que si elles existent
    const runeStats = unitData.runes ? calculateRuneStats(unitData.runes) : { HP_FLAT: 0, HP_PERC: 0, ATK_FLAT: 0, ATK_PERC: 0, DEF_FLAT: 0, DEF_PERC: 0, SPD: 0, CR: 0, CD: 0, RES: 0, ACC: 0 };
    runeSetsHtml = unitData.runes ? createIndividualRunesHtml(unitData.runes) : '<p>Aucune rune équipée.</p>';

    // Génère le HTML pour le tiroir de droite (stats complètes)
    statsDisplayHtml = `
      <p><span>Element:</span> ${element}</p>
      <p><span>Archetype:</span> ${archetype}</p>
      <p><span>HP:</span> ${max_lvl_hp} <span class="rune-bonus">+${Math.round(max_lvl_hp * (runeStats.HP_PERC / 100)) + runeStats.HP_FLAT}</span></p>
      <p><span>ATK:</span> ${max_lvl_attack} <span class="rune-bonus">+${Math.round(max_lvl_attack * (runeStats.ATK_PERC / 100)) + runeStats.ATK_FLAT}</span></p>
      <p><span>DEF:</span> ${max_lvl_defense} <span class="rune-bonus">+${Math.round(max_lvl_defense * (runeStats.DEF_PERC / 100)) + runeStats.DEF_FLAT}</span></p>
      <p><span>SPD:</span> ${speed} <span class="rune-bonus">+${runeStats.SPD}</span></p>
      <p><span>CR:</span> ${crit_rate}% <span class="rune-bonus">+${runeStats.CR}%</span></p>
      <p><span>CD:</span> ${crit_damage}% <span class="rune-bonus">+${runeStats.CD}%</span></p>
      <p><span>RES:</span> ${resistance}% <span class="rune-bonus">+${runeStats.RES}%</span></p>
      <p><span>ACC:</span> ${accuracy}% <span class="rune-bonus">+${runeStats.ACC}%</span></p>
    `;
  } else {
    // Sinon, on affiche les stats de base et les stats comparatives
    statsDisplayHtml = `
      <p><span>Element:</span> ${element}</p>
      <p><span>Archetype:</span> ${archetype}</p>
      <p><span>HP:</span> ${max_lvl_hp} | <span>ATK:</span> ${max_lvl_attack}</p>
      <p><span>DEF:</span> ${max_lvl_defense} | <span>SPD:</span> ${speed}</p>
      <p><span>CR:</span> ${crit_rate}% | <span>CD:</span> ${crit_damage}%</p>
      <p><span>RES:</span> ${resistance}% | <span>ACC:</span> ${accuracy}%</p>
      <div class="rune-stats">
        <p class="rune-stats-title">Stats Moyennes (Tous les monstres)</p>
        <div class="rune-stats-grid">
          <p><span>HP:</span> ${globalMonsterStats.hp.avg}</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>ATK:</span> ${globalMonsterStats.atk.avg}</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>DEF:</span> ${globalMonsterStats.def.avg}</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>SPD:</span> ${globalMonsterStats.spd.avg}</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>CR:</span> ${globalMonsterStats.cr.avg}%</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>CD:</span> ${globalMonsterStats.cd.avg}%</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>RES:</span> ${globalMonsterStats.res.avg}%</p> <!-- Utilisation des stats globales pré-calculées -->
          <p><span>ACC:</span> ${globalMonsterStats.acc.avg}%</p> <!-- Utilisation des stats globales pré-calculées -->
        </div>
      </div>
    `;
  }

  return `
    <div class="jarvis-card">
      <div class="jarvis-card-inner">
        <!-- Tiroir Gauche (Runes) -->
        <div class="jarvis-card-runes">
          <div class="jarvis-corner top-left"></div>
          <div class="jarvis-corner top-right"></div>
          <div class="jarvis-corner bottom-left"></div>
          <div class="jarvis-corner bottom-right"></div>
          <div class="individual-runes-container">${runeSetsHtml}</div>
        </div>
        <!-- Face Avant -->
        <div class="jarvis-card-front">
          <div class="jarvis-corner top-left"></div>
          <div class="jarvis-corner top-right"></div>
          <div class="jarvis-corner bottom-left"></div>
          <div class="jarvis-corner bottom-right"></div>
          <div class="jarvis-content">
              <div class="jarvis-image-container">
                  <img src="${imgUrl}" alt="${name}">
              </div>
              ${radialChart}
              <div class="jarvis-name" style="margin-top: 5px;">${name}</div>
          </div>
        </div>
        <!-- Tiroir Droit (Stats) -->
        <div class="jarvis-card-back">
          <div class="jarvis-corner top-left"></div>
          <div class="jarvis-corner top-right"></div>
          <div class="jarvis-corner bottom-left"></div>
          <div class="jarvis-corner bottom-right"></div>
          <div class="jarvis-stats">
              <div class="jarvis-name" style="margin-bottom: 10px;">${name}</div>
              ${statsDisplayHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

// --- Logique d'autocomplétion ---

searchInput.addEventListener('input', (e) => {
  const query = searchInput.value;
  const words = query.split(' ');
  const currentWord = words[words.length - 1].trim().toLowerCase();
  // Récupère les noms déjà tapés pour ne pas les suggérer à nouveau
  const existingNames = new Set(words.slice(0, -1).map(w => strNoAccent(w.trim().toLowerCase())));

  if (currentWord.length === 0) {
    clearSuggestions();
    return;
  }
  const normalizedCurrentWord = strNoAccent(currentWord);

  const suggestions = allMonsters
    .filter(m => {
      const monsterNameLower = strNoAccent(m.fields.name.toLowerCase());
      // Suggère seulement si le nom commence par le mot actuel ET n'est pas déjà dans la recherche
      return monsterNameLower.startsWith(normalizedCurrentWord) && !existingNames.has(monsterNameLower);
    })
    .slice(0, 5);

  if (suggestions.length > 0) {
    suggestionsContainer.innerHTML = suggestions.map(s =>
      `<div class="suggestion-item">${s.fields.name}</div>`
    ).join('');
  } else {
    clearSuggestions();
  }
});

// Cache les suggestions si on clique ailleurs
document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-container')) {
    clearSuggestions();
  }
});

// Utilisation de la délégation d'événements pour les suggestions
suggestionsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('suggestion-item')) {
    const words = searchInput.value.split(' ');
    const baseQuery = words.slice(0, -1).join(' ');
    searchInput.value = (baseQuery ? baseQuery + ' ' : '') + e.target.textContent + ' ';
    clearSuggestions();
    searchInput.focus();
  }
});

function clearSuggestions() {
  suggestionsContainer.innerHTML = '';
}

function showResult(html) {
  // Utiliser innerHTML est acceptable ici car le contenu provient de notre propre code
  // et non d'une saisie utilisateur non filtrée.
  resultContainer.innerHTML = html;
}

function resetSearch() {
  searchInput.value = '';
  showResult('');
  clearSuggestions();
}

function strNoAccent(str) {
  // Sépare les caractères de base de leurs accents, puis supprime les accents
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function displayFileVersions() {
  const versionContainer = document.getElementById('version-container');
  if (versionContainer) {
    versionContainer.innerHTML = `
      index: v${fileVersions.index}<br>
      style: v${fileVersions.style}<br>
      script: v${fileVersions.script}
    `;
  }
}

/**
 * Initialise les deux vues du bestiaire (complet et personnel)
 * et la logique de navigation par onglets.
 */
function initializeBestiaryViews() {
  // --- BESTIAIRE COMPLET ---
  const container = document.getElementById('monster-list-container');
  const tabsContainer = document.querySelector('.element-tabs');
  if (!container || !tabsContainer) return;

  // Fonction pour générer et afficher la grille pour un élément donné
  const displayGridForElement = (element) => {
    const monstersToDisplay = awakenedMonsters.filter(m => m.fields.element === element);
    // Tri pour afficher les monstres possédés en premier
    monstersToDisplay.sort((a, b) => {
      const isOwnedA = ownedMonsterIds.has(a.fields.com2us_id);
      const isOwnedB = ownedMonsterIds.has(b.fields.com2us_id);
      if (isOwnedA !== isOwnedB) return isOwnedA ? -1 : 1; // Trie par possession
      return a.pk - b.pk; // Puis par ID
    });

    const monsterListHtml = monstersToDisplay.map(monster => {
        const { name, element, image_filename, com2us_id } = monster.fields;
        const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;
        // Vérifie si le monstre est possédé et ajoute une classe si ce n'est pas le cas
        const isOwned = ownedMonsterIds.has(com2us_id);
        const ownedClass = isOwned ? '' : 'not-owned';
        return `<div class="monster-grid-item ${ownedClass}" data-element="${element}" data-name="${name}" title="${name}"><img src="${imgUrl}" alt="${name}" loading="lazy"></div>`;
      }).join('');

    container.innerHTML = `<div class="monster-grid">${monsterListHtml}</div>`;
  };

  // Ajoute la logique de clic sur les onglets
  tabsContainer.addEventListener('click', (e) => {
    if (e.target.matches('.element-tab')) {
      const selectedElement = e.target.dataset.element;

      // Met à jour la classe 'active' sur les onglets
      tabsContainer.querySelector('.active').classList.remove('active');
      e.target.classList.add('active');

      displayGridForElement(selectedElement);
    }
  });

  // Affiche la grille pour le premier onglet ("fire") par défaut
  displayGridForElement('fire');

  // Ajoute la logique de clic sur un monstre de la liste
  container.addEventListener('click', (e) => {
    const gridItem = e.target.closest('.monster-grid-item');
    if (gridItem) {
      const monsterName = gridItem.dataset.name.toLowerCase();
      const monsterData = awakenedMonsters.find(m => m.fields.name.toLowerCase() === monsterName);
      if (monsterData) {
        const cardHtml = createMonsterCard(monsterData);
        showMonsterInModal(cardHtml);
      }
    }
  });

  // --- GESTION DES ONGLETS PRINCIPAUX ---
  const mainTabsContainer = document.querySelector('.main-tabs');
  const viewContainers = document.querySelectorAll('.view-container');

  mainTabsContainer.addEventListener('click', (e) => {
    if (e.target.matches('.main-tab')) {
      const selectedView = e.target.dataset.view;

      // Met à jour la classe 'active' sur les onglets principaux
      mainTabsContainer.querySelector('.active').classList.remove('active');
      e.target.classList.add('active');

      // Affiche le bon conteneur de vue
      viewContainers.forEach(vc => {
        if (vc.id === `${selectedView}-container`) {
          vc.classList.add('active');
        } else {
          vc.classList.remove('active');
        }
      });
    }
  });
}

/**
 * Affiche une carte de monstre dans une modale pop-up.
 * @param {string} cardHtml - Le code HTML de la carte à afficher.
 */
function showMonsterInModal(cardHtml) {
  // Crée la modale si elle n'existe pas
  let modal = document.getElementById('monster-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'monster-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = '<div class="modal-content"></div>';
    document.body.appendChild(modal);

    // Ajoute un événement pour fermer la modale en cliquant sur le fond
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'monster-modal') {
        closeModal();
      }
    });

    // Ajoute un événement pour gérer l'ouverture du tiroir de la carte DANS la modale
    modal.addEventListener('click', (e) => {
      const card = e.target.closest('.jarvis-card');
      if (!card) return;

      const isRunesOpen = card.classList.contains('is-runes-open');
      const isStatsOpen = card.classList.contains('is-stats-open');

      // Si on clique sur le tiroir des runes, on le bascule
      if (e.target.closest('.jarvis-card-runes')) {
        card.classList.toggle('is-runes-open');
      } // Si on clique sur le tiroir des stats, on le bascule
      else if (e.target.closest('.jarvis-card-back')) { 
        card.classList.toggle('is-stats-open');
      } // Si on clique sur la face avant, on bascule le tiroir des stats
      else if (e.target.closest('.jarvis-card-front')) {
        card.classList.toggle('is-stats-open');
      }
    });
  }

  // Injecte la carte et affiche la modale
  modal.querySelector('.modal-content').innerHTML = cardHtml;
  modal.classList.add('visible');
}

function closeModal() {
  const modal = document.getElementById('monster-modal');
  if (modal) {
    modal.classList.remove('visible');
  }
}

/**
 * Calcule le total des stats bonus apportées par un set de runes.
 * @param {Array} runes - Le tableau de runes d'un monstre.
 * @returns {object} Un objet avec le total de chaque stat.
 */
function calculateRuneStats(runes) {
  const totals = {
    HP_FLAT: 0, HP_PERC: 0, ATK_FLAT: 0, ATK_PERC: 0,
    DEF_FLAT: 0, DEF_PERC: 0, SPD: 0, CR: 0, CD: 0, RES: 0, ACC: 0
  };
  if (!runes) return totals;

  const statMap = {
    1: 'HP_FLAT', 2: 'HP_PERC', 3: 'ATK_FLAT', 4: 'ATK_PERC',
    5: 'DEF_FLAT', 6: 'DEF_PERC', 8: 'SPD', 9: 'CR',
    10: 'CD', 11: 'RES', 12: 'ACC'
  };

  // Les runes sont un objet { '1': {...}, '2': {...} }, on le transforme en tableau
  const runeArray = Object.values(runes);

  runeArray.forEach(rune => {
    // Stat principale
    if (rune.primary_effect) {
        const mainStatId = rune.primary_effect[0];
        const mainStatValue = rune.primary_effect[1];
        if (statMap[mainStatId]) {
            totals[statMap[mainStatId]] += mainStatValue;
        }
    }

    // Substats
    if (rune.secondary_effects) {
        rune.secondary_effects.forEach(sub => {
            const subStatId = sub[0];
            const subStatValue = sub[1] + (sub[3] || 0); // Valeur de base + meule
            if (statMap[subStatId]) {
                totals[statMap[subStatId]] += subStatValue;
            }
        });
    }
  });

  return totals;
}

/**
 * Identifie les sets de runes équipés sur un monstre.
 * @param {object} runes - L'objet de runes d'un monstre.
 * @returns {Array} Un tableau d'objets représentant les sets complets.
 */
function getRuneSets(runes) {
    const runeSetMap = {
        1: { name: 'Energy', amount: 2 }, 2: { name: 'Guard', amount: 2 },
        3: { name: 'Swift', amount: 4 }, 4: { name: 'Blade', amount: 2 },
        5: { name: 'Rage', amount: 4 }, 6: { name: 'Focus', amount: 2 },
        7: { name: 'Endure', amount: 2 }, 8: { name: 'Fatal', amount: 4 },
        10: { name: 'Despair', amount: 4 }, 11: { name: 'Vampire', amount: 4 },
        13: { name: 'Violent', amount: 4 }, 14: { name: 'Nemesis', amount: 2 },
        15: { name: 'Will', amount: 2 }, 16: { name: 'Shield', amount: 2 },
        17: { name: 'Revenge', amount: 2 }, 18: { name: 'Destroy', amount: 2 },
        19: { name: 'Fight', amount: 2 }, 20: { name: 'Determination', amount: 2 },
        21: { name: 'Enhance', amount: 2 }, 22: { name: 'Accuracy', amount: 2 },
        23: { name: 'Tolerance', amount: 2 }, 24: { name: 'Seal', amount: 2 },
        25: { name: 'Intangible', amount: 2 }
    };

    const counts = {};
    Object.values(runes).forEach(rune => {
        const setId = rune.set_id;
        if (setId) counts[setId] = (counts[setId] || 0) + 1;
    });

    const activeSets = [];
    for (const setId in counts) {
        const setData = runeSetMap[setId];
        const numSets = Math.floor(counts[setId] / setData.amount);
        if (numSets > 0) activeSets.push({ name: setData.name, count: numSets });
    }
    return activeSets;
}

/**
 * Crée le HTML pour afficher les 6 runes individuelles et leurs stats.
 * @param {object} runes - L'objet de runes d'un monstre.
 * @returns {string} Le code HTML pour le tiroir des runes.
 */
function createIndividualRunesHtml(runes) {
  if (!runes || Object.keys(runes).length === 0) {
    return '<p>Aucune rune équipée.</p>';
  }

  const statNameMap = {
    1: 'HP', 2: 'HP %', 3: 'ATK', 4: 'ATK %',
    5: 'DEF', 6: 'DEF %', 8: 'SPD', 9: 'CRIT Rate',
    10: 'CRIT Dmg', 11: 'RES', 12: 'ACC'
  };
  const runeSetMap = {
    1: 'Energy', 2: 'Guard', 3: 'Swift', 4: 'Blade', 5: 'Rage', 6: 'Focus',
    7: 'Endure', 8: 'Fatal', 10: 'Despair', 11: 'Vampire', 13: 'Violent',
    14: 'Nemesis', 15: 'Will', 16: 'Shield', 17: 'Revenge', 18: 'Destroy',
    19: 'Fight', 20: 'Determination', 21: 'Enhance', 22: 'Accuracy',
    23: 'Tolerance', 24: 'Seal', 25: 'Intangible'
  };

  let html = '';
  // On trie par slot (1 à 6)
  for (const slot of Object.keys(runes).sort()) {
    const rune = runes[slot];
    const mainStatId = rune.primary_effect[0];
    const mainStatValue = rune.primary_effect[1];
    const mainStatName = statNameMap[mainStatId] || 'Inconnu';
    const isPercent = mainStatName.includes('%');

    html += `<div class="rune-item">`;
    html += `<div class="rune-item-header">Rune ${slot} (${runeSetMap[rune.set_id]})</div>`;
    html += `<div class="rune-item-main-stat">${mainStatName}: +${mainStatValue}${isPercent ? '%' : ''}</div>`;

    if (rune.secondary_effects && rune.secondary_effects.length > 0) {
      html += `<ul class="rune-item-substats">`;
      rune.secondary_effects.forEach(sub => {
        const subStatId = sub[0];
        const subStatValue = sub[1] + (sub[3] || 0); // Valeur + meule
        const subStatName = statNameMap[subStatId] || 'Inconnu';
        const isSubPercent = subStatName.includes('%');
        html += `<li>${subStatName}: +${subStatValue}${isSubPercent ? '%' : ''}</li>`;
      });
      html += `</ul>`;
    }
    html += `</div>`;
  }
  return html;
}

function createRadialBarChart(monsterStats) {
  const statsOrder = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  const labels = ['HP', 'ATK', 'DEF', 'SPD', 'CR', 'CD', 'RES', 'ACC'];
  const numStats = statsOrder.length;

  // Dimensions et configuration du graphique
  const width = 180;
  const height = 150;
  const center = { x: width / 2, y: height / 2 + 5 };
  const radius = 65;
  const anglePerStat = 360 / numStats;
  const arcPadding = 2; // Espace en degrés entre les parts de tarte

  // Objet pour mapper les noms de stats courts aux noms de champs réels dans les données
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

  // Fonction pour dessiner une part de camembert (secteur)
  const describeSector = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    // M(center) L(start of arc) A(arc) Z(close path to center)
    return `M ${x},${y} L ${start.x},${start.y} A ${radius},${radius} 0 ${largeArcFlag} 1 ${end.x},${end.y} Z`;
  };

  // Fonction pour dessiner un arc de cercle
  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, startAngle);
    const end = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
  };

  let chartHtml = '';
  statsOrder.forEach((stat, i) => {
    const startAngle = i * anglePerStat;
    const endAngle = startAngle + anglePerStat - arcPadding; // Applique l'espacement

    const monsterValue = monsterStats[statFieldMap[stat]];
    const avgValue = globalMonsterStats[stat].avg;
    const maxValue = MAX_STATS[stat];

    const monsterPercentage = monsterValue / maxValue;
    const avgPercentage = avgValue / maxValue;
    
    const monsterRadius = monsterPercentage * radius;
    const avgRadius = avgPercentage * radius;

    // Part de fond (représente 100%)
    chartHtml += `<path class="radial-bar-bg" d="${describeSector(center.x, center.y, radius, startAngle, endAngle)}"></path>`;
    
    // Part de la stat du monstre
    chartHtml += `<path fill="url(#statGradient)" d="${describeSector(center.x, center.y, monsterRadius, startAngle, endAngle)}"></path>`;

    // Marqueur de la moyenne
    chartHtml += `<path class="avg-marker" d="${describeArc(center.x, center.y, avgRadius, startAngle, endAngle)}"></path>`;

    // Label de la stat
    const labelPoint = polarToCartesian(center.x, center.y, radius + 12, startAngle + (anglePerStat / 2));
    chartHtml += `<text class="label" x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" dominant-baseline="middle">${labels[i]}</text>`;
  });

  return `
    <div class="radial-chart-container">
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
        <defs>
          <radialGradient id="statGradient" cx="${center.x}" cy="${center.y}" r="${radius}" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f44336" /> <!-- Rouge au centre -->
            <stop offset="50%" stop-color="#ffeb3b" /> <!-- Jaune au milieu -->
            <stop offset="100%" stop-color="#4caf50" /> <!-- Vert à l'extérieur -->
          </radialGradient>
        </defs>
        ${chartHtml}
      </svg>
    </div>
  `;
}