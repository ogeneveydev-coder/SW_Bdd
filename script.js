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

      // 2. On ne garde que les monstres ÉVEILLÉS dans awakenedMonsters pour l'affichage des grilles
      awakenedMonsters = allMonsters.filter(m => m.fields.is_awakened);

      if (myBestiaryData && myBestiaryData.unit_list) {
        myMonsters = myBestiaryData.unit_list;
        ownedMonsterIds = new Set(myMonsters.map(m => m.unit_master_id));
      }

      // Pré-calcule les statistiques globales sur tous les monstres filtrés
      const stats = {
        hp:  awakenedMonsters.map(m => m.fields.base_hp),
        atk: awakenedMonsters.map(m => m.fields.base_attack),
        def: awakenedMonsters.map(m => m.fields.base_defense),
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


  // Ajoute un écouteur de clic sur le conteneur de résultats pour gérer la rotation des cartes
  resultContainer.addEventListener('click', function(e) {
    const card = e.target.closest('.jarvis-card');
    if (card) {
      card.classList.toggle('is-open');
    }
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
    const monsterType = awakenedMonsters.find(m => m.fields.com2us_id === specificMonster.unit_master_id);
    if (monsterType) {
      const cardHtml = createMonsterCard(monsterType, specificMonster); // Crée la carte
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
  const { name, element, archetype, base_hp, base_attack, base_defense, speed, crit_rate, crit_damage, resistance, accuracy, image_filename } = monsterData.fields;
  const radialChart = createRadialBarChart(monsterData.fields);
  const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;

  let statsDisplayHtml;

  if (unitData) {
    // Si on a les données d'un monstre spécifique (avec runes)
    const runeStats = calculateRuneStats(unitData.runes);
    statsDisplayHtml = `
      <p><span>Element:</span> ${element}</p>
      <p><span>Archetype:</span> ${archetype}</p>
      <p><span>HP:</span> ${base_hp} <span class="rune-bonus">+${Math.round(base_hp * (runeStats.HP_PERC / 100)) + runeStats.HP_FLAT}</span></p>
      <p><span>ATK:</span> ${base_attack} <span class="rune-bonus">+${Math.round(base_attack * (runeStats.ATK_PERC / 100)) + runeStats.ATK_FLAT}</span></p>
      <p><span>DEF:</span> ${base_defense} <span class="rune-bonus">+${Math.round(base_defense * (runeStats.DEF_PERC / 100)) + runeStats.DEF_FLAT}</span></p>
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
      <p><span>HP:</span> ${base_hp} | <span>ATK:</span> ${base_attack}</p>
      <p><span>DEF:</span> ${base_defense} | <span>SPD:</span> ${speed}</p>
      <p><span>CR:</span> ${crit_rate}% | <span>CD:</span> ${crit_damage}%</p>
      <p><span>RES:</span> ${resistance}% | <span>ACC:</span> ${accuracy}%</p>
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
  }

  return `
    <div class="jarvis-card">
      <div class="jarvis-card-inner">
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
        <!-- Face Arrière -->
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
    // Tri par identifiant (pk = Primary Key) au lieu du nom
    const filteredMonsters = monstersToDisplay.sort((a, b) => a.pk - b.pk);

    const monsterListHtml = filteredMonsters.map(monster => {
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

  // --- MES MONSTRES ---
  const myContainer = document.getElementById('my-monster-list-container');
  if (myContainer) {
    populateMyBestiary();

    // Ajoute la logique de clic sur un monstre de la liste personnelle
    myContainer.addEventListener('click', (e) => {
      const gridItem = e.target.closest('.monster-grid-item');
      if (gridItem) {
        const monsterId = parseInt(gridItem.dataset.id, 10);
        // On appelle directement la recherche par ID qui va ouvrir la modale
        searchMonster(monsterId);
      }
    });
  }

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

function populateMyBestiary() {
  const container = document.getElementById('my-monster-list-container');
  if (!container || myMonsters.length === 0) {
    container.innerHTML = "<p>Aucun monstre trouvé dans 'my_bestiary.json'.</p>";
    return;
  }

  // Crée une map pour un accès rapide aux données du monstre par son ID de base
  const awakenedMonsterMap = new Map(awakenedMonsters.map(m => [m.fields.com2us_id, m]));

  // Tri des monstres personnels par l'ID de base (pk) pour le regroupement
  const sortedMyMonsters = [...myMonsters].sort((a, b) => {
    const monsterA = awakenedMonsterMap.get(a.unit_master_id);
    const monsterB = awakenedMonsterMap.get(b.unit_master_id);
    if (!monsterA || !monsterB) return 0;
    return monsterA.pk - monsterB.pk;
  });

  const monsterListHtml = sortedMyMonsters.map(myUnit => {
    const monsterType = awakenedMonsterMap.get(myUnit.unit_master_id);
    if (!monsterType) return ''; // Ne pas afficher si le type n'est pas trouvé

    const { name, element, image_filename } = monsterType.fields;
    const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;
    // On utilise l'ID unique de l'unité (unit_id)
    return `<div class="monster-grid-item" data-id="${myUnit.unit_id}" data-name="${name}" title="${name}"><img src="${imgUrl}" alt="${name}" loading="lazy"></div>`;
  }).join('');

  container.innerHTML = `<div class="monster-grid">${monsterListHtml}</div>`;
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

  runes.forEach(rune => {
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
    hp: 'base_hp', atk: 'base_attack', def: 'base_defense', spd: 'speed',
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