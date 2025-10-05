/* tada*/

// --- GESTION DES VERSIONS ---
// Mettez à jour ces valeurs lorsque vous modifiez un fichier. (Version mise à jour pour cette modification)
const fileVersions = {
  script: '2.46',
  style: '2.40', // Pas de changement de style
  index: '2.15' // Version mise à jour pour la nouvelle structure en 4 sections
};
const allMonsters = []; // Contiendra TOUS les monstres (éveillés et non-éveillés) pour la recherche
let awakenedMonsters = []; // Ne contiendra que les monstres éveillés pour l'affichage
let myMonsters = []; // Stockera les monstres du joueur
let ownedMonsterIds = new Set(); // Stockera les IDs des monstres possédés pour une recherche rapide
let globalMonsterStats = {}; // Stockera les stats min/avg/max de tous les monstres

let teamsData = []; // Stockera les données des équipes
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
const bestiaryTabs = document.querySelector('.element-tabs');
const drawerHandle = document.getElementById('drawer-handle');

// Charger les données une seule fois au démarrage
window.addEventListener('DOMContentLoaded', () => {
  displayFileVersions(); // Affiche les versions au chargement

  // Utilisation de Promise.all pour charger les deux fichiers en parallèle
  Promise.all([
    fetch('bestiary_data.json').then(res => res.json()),
    fetch('my_bestiary.json').then(res => res.json()).catch(err => {
      console.warn("Fichier my_bestiary.json non trouvé ou invalide. La section 'Mes Monstres' sera vide.", err);
      return null; // Retourne null si le fichier n'existe pas pour ne pas bloquer le reste
    }),
    fetch('teams.json').then(res => res.json()).catch(err => {
      console.warn("Fichier teams.json non trouvé ou invalide.", err);
      return []; // Retourne un tableau vide en cas d'erreur
    })
  ])
    .then(([bestiaryData, myBestiaryData, loadedTeamsData]) => {
      // 1. On charge TOUS les monstres 2-6 étoiles dans allMonsters pour la recherche
      const allRelevantMonsters = bestiaryData.filter(obj => obj.model === "bestiary.monster" && obj.fields.natural_stars >= 2);
      allMonsters.push(...allRelevantMonsters);

      // 2. On ne garde que les monstres ÉVEILLÉS dans awakenedMonsters pour l'affichage des grilles et la recherche de type
      awakenedMonsters = allMonsters.filter(m => m.fields.is_awakened);

      if (myBestiaryData && myBestiaryData.unit_list) {
        myMonsters = myBestiaryData.unit_list;
        ownedMonsterIds = new Set(myMonsters.map(m => m.unit_master_id));
      }

      // On stocke les données des équipes
      teamsData = loadedTeamsData;

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

      // CORRECTION : On initialise le bestiaire ICI, une fois que TOUTES les données sont prêtes.
      initializeBestiaryViews();

    })
    .catch(err => {
      console.error("Erreur lors du chargement des données du bestiaire.", err);
      showResult("Impossible de charger les données des monstres.");
    });

});

// --- Logique pour le tiroir latéral 'Monstres' ---
drawerHandle.addEventListener('click', () => {
  const drawer = document.getElementById('bestiary-section');
  const isOpen = drawer.classList.toggle('is-open');

  // Change la flèche pour indiquer l'état
  if (isOpen) {
    drawerHandle.textContent = '‹';
  } else {
    drawerHandle.textContent = '›';
  }
});

/**
 * Ferme le tiroir du bestiaire s'il est ouvert.
 */
function closeBestiaryDrawer() {
  const drawer = document.getElementById('bestiary-section');
  if (drawer && drawer.classList.contains('is-open')) {
    drawer.classList.remove('is-open'); // Cache la section
    drawerHandle.textContent = '›';
  }
}

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // Empêche le rechargement de la page
    clearSuggestions();
    searchMonster(); // Appel direct de la fonction de recherche
  } else if (e.key === 'Escape') {
    resetSearch(); // Utilise resetSearch pour tout effacer
  }
});

searchBtn.addEventListener('click', () => searchMonster());
resetBtn.addEventListener('click', resetSearch);

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

    // 2. Si le monstre n'est pas éveillé, trouver sa première forme éveillée.
    // On ne suit PAS la chaîne pour les formes alternatives (ex: Druides).
    // CORRECTION : On suit la chaîne d'éveil, mais on s'arrête si la forme suivante
    // s'éveille depuis la forme actuelle (cas des formes alternatives comme les Druides).
    while (monsterType.fields.awakens_to) {
      const nextForm = allMonsters.find(m => m.pk === monsterType.fields.awakens_to);
      if (nextForm) {
        // On s'arrête si la forme suivante a le même nom (cas des Druides, Licornes, etc.)
        if (nextForm.fields.name === monsterType.fields.name) {
          break;
        }
        monsterType = nextForm;
      } else {
        break; // Arrête la boucle si la forme suivante n'est pas trouvée
      }
    }
    
    if (monsterType) { // On a maintenant la bonne forme (éveillée) à afficher
      const cardHtml = createMonsterCard(monsterType, specificMonster);
      showMonsterInModal(cardHtml); // Affiche dans la modale
    }
    return;
  }

  // --- Recherche par nom (comportement existant) ---
  const searchTerms = query.split(' ').map(term => strNoAccent(term.trim().toLowerCase())).filter(Boolean);
  const foundMonsters = [];

  // CORRECTION: On ne filtre plus les doublons ici pour permettre la recherche d'équipes avec des monstres identiques.
  // Pour chaque terme de recherche, on trouve les monstres correspondants
  for (const term of searchTerms) {
    // CORRECTION : On vérifie si le terme est un nom de famille (non-éveillé) partagé par plusieurs éléments.
    const familyMatches = allMonsters.filter(m => !m.fields.is_awakened && strNoAccent(m.fields.name.toLowerCase()) === term);
    const isFamilyName = new Set(familyMatches.map(m => m.fields.element)).size > 1;

    // Si c'est un nom de famille, on ignore ce terme pour éviter d'afficher toute la famille.
    if (isFamilyName) {
      continue; // Passe au terme de recherche suivant
    }

    for (const monster of allMonsters) {
      const monsterName = strNoAccent(monster.fields.name.toLowerCase());
      // Si le terme de recherche correspond exactement au nom d'un monstre
      if (monsterName === term) {
        let monsterToShow = monster;

        while (monsterToShow.fields.awakens_to) {
          const nextForm = allMonsters.find(m => m.pk === monsterToShow.fields.awakens_to);
          if (nextForm) {
            // On s'arrête si la forme suivante a le même nom (cas des Druides, Licornes, etc.)
            if (nextForm.fields.name === monsterToShow.fields.name) {
              break;
            }
            monsterToShow = nextForm;
          } else {
            break; // Arrête la boucle si la forme suivante n'est pas trouvée
          }
        }

        // On ajoute le monstre à la liste des résultats s'il n'y est pas déjà
        if (monsterToShow) {
          foundMonsters.push(monsterToShow);
        }
        // Une fois qu'on a trouvé et traité la première correspondance pour ce nom, on arrête de chercher.
        break; // Sort de la boucle `for (const monster of allMonsters)`
      }
    }
  }

  if (foundMonsters.length === 0) {
    showResult("Aucun des monstres recherchés n'a été trouvé.");
    return;
  }

  // Construit une carte HTML pour chaque monstre trouvé
  const cardsHtml = foundMonsters.map(monster => createMonsterCard(monster)).join('');

  // Affiche les cartes dans un conteneur
  showResult(`<div class="results-container">${cardsHtml}</div>`);

  // SIMPLIFICATION : Si exactement 3 monstres sont trouvés, on affiche le bouton "Add Counter".
  const counterSection = document.getElementById('counter-teams-section');
  const addCounterContainer = document.getElementById('add-counter-container');
  const counterResultContainer = document.getElementById('counter-teams-result');

  if (foundMonsters.length === 3) {
    addCounterContainer.innerHTML = `<button id="add-counter-btn">Add Counter</button>`;
    // On attache l'événement pour ouvrir la modale
    document.getElementById('add-counter-btn').addEventListener('click', () => openAddCounterModal(foundMonsters));
    counterResultContainer.innerHTML = ''; // On s'assure que la zone des résultats de counter est vide.
    counterSection.style.display = 'block'; // On affiche la section pour voir le bouton.
  } else {
    // On s'assure de cacher la section des counters si on n'a pas 3 monstres.
    counterSection.style.display = 'none';
  }
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

  // SIMPLIFICATION : On affiche toujours les stats de base, qu'on possède le monstre ou non.
  const statsDisplayHtml = `
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

  // 1. Trouver tous les noms de monstres uniques qui correspondent
  const matchingNames = [...new Set(allMonsters
      .filter(m => strNoAccent(m.fields.name.toLowerCase()).startsWith(normalizedCurrentWord))
      .map(m => m.fields.name)
  )];

  // 2. Filtrer les noms de famille
  const suggestions = matchingNames.filter(name => {
    const normalizedName = strNoAccent(name.toLowerCase());
    // Un nom est considéré comme un nom de famille s'il existe en tant que nom non-éveillé pour plusieurs éléments.
    const familyMatches = allMonsters.filter(m => !m.fields.is_awakened && strNoAccent(m.fields.name.toLowerCase()) === normalizedName);
    const isFamilyName = new Set(familyMatches.map(m => m.fields.element)).size > 1;

    // On ne suggère pas le nom s'il est déjà dans la recherche ou si c'est un nom de famille
    return !existingNames.has(normalizedName) && !isFamilyName;
  }).slice(0, 5); // Limite à 5 suggestions


  if (suggestions.length > 0) {
    suggestionsContainer.innerHTML = suggestions.map(s =>
      `<div class="suggestion-item">${s}</div>`
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

  // On décale le tiroir vers le bas si des résultats s'affichent, et on le remet en place sinon.
  const monsterSearchSection = document.getElementById('monster-search-section');
  if (html && html.trim() !== '') {
    // Si on a des résultats, on les affiche. La section est déjà visible.
    resultContainer.style.display = 'block';
  } else {
    // S'il n'y a pas de résultats, on cache le conteneur de résultats.
    resultContainer.style.display = 'none';
  }
  resultContainer.innerHTML = html;
}

function resetSearch() {
  searchInput.value = '';
  showResult('');
  clearSuggestions();
  document.getElementById('counter-teams-section').style.display = 'none'; // Cache aussi les counters
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
  const monsterListContainer = document.getElementById('monster-list-container');  if (!monsterListContainer || !bestiaryTabs) return;

  // Fonction pour générer et afficher la grille pour un élément donné
  const displayGridForElement = (element) => {
    const monstersToDisplay = awakenedMonsters.filter(m => m.fields.element === element);    
    // Tri pour afficher les monstres possédés en premier
    monstersToDisplay.sort((a, b) => {
      // CORRECTION : La logique de tri doit aussi vérifier les formes non-éveillées
      const isOwnedA = ownedMonsterIds.has(a.fields.com2us_id) || (a.fields.awakens_from && ownedMonsterIds.has(allMonsters.find(m => m.pk === a.fields.awakens_from)?.fields.com2us_id));
      const isOwnedB = ownedMonsterIds.has(b.fields.com2us_id) || (b.fields.awakens_from && ownedMonsterIds.has(allMonsters.find(m => m.pk === b.fields.awakens_from)?.fields.com2us_id));

      if (isOwnedA !== isOwnedB) return isOwnedA ? -1 : 1;
      return a.pk - b.pk; // Puis par ID
    });

    const monsterListHtml = monstersToDisplay.map(monster => {
        const { name, element, image_filename, com2us_id } = monster.fields;
        const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;

        // CORRECTION : Vérifie si le joueur possède la forme éveillée OU non-éveillée
        const unawakenedMonster = monster.fields.awakens_from ? allMonsters.find(m => m.pk === monster.fields.awakens_from) : null;
        const unawakenedId = unawakenedMonster ? unawakenedMonster.fields.com2us_id : null;
        
        const isOwned = ownedMonsterIds.has(com2us_id) || (unawakenedId && ownedMonsterIds.has(unawakenedId));
        const ownedClass = isOwned ? '' : 'not-owned';

        return `<div class="monster-grid-item ${ownedClass}" data-element="${element}" data-name="${name}" title="${name}"><img src="${imgUrl}" alt="${name}" loading="lazy"></div>`;
      }).join('');

    monsterListContainer.innerHTML = `<div class="monster-grid">${monsterListHtml}</div>`;
  };

  // Ajoute la logique de clic sur les onglets
  bestiaryTabs.addEventListener('click', (e) => {
    if (e.target.matches('.element-tab')) {
      const selectedElement = e.target.dataset.element;

      // Met à jour la classe 'active' sur les onglets
      bestiaryTabs.querySelector('.active').classList.remove('active');
      e.target.classList.add('active');

      displayGridForElement(selectedElement);
    }
  });

  // Affiche la grille pour le premier onglet ("fire") par défaut
  displayGridForElement('fire');

  // Ajoute la logique de clic sur un monstre de la liste
  monsterListContainer.addEventListener('click', (e) => {
    const gridItem = e.target.closest('.monster-grid-item');
    if (gridItem) {
      const monsterName = gridItem.dataset.name.toLowerCase();
      const monsterType = awakenedMonsters.find(m => m.fields.name.toLowerCase() === monsterName);
      if (monsterType) {
        // CORRECTION : On cherche si le joueur possède ce monstre
        // On doit aussi trouver la forme non-éveillée pour vérifier si le joueur la possède.
        const unawakenedMonster = monsterType.fields.awakens_from ? allMonsters.find(m => m.pk === monsterType.fields.awakens_from) : null;
        const unawakenedId = unawakenedMonster ? unawakenedMonster.fields.com2us_id : null;
        
        // On cherche une unité qui correspond soit à l'ID éveillé, soit à l'ID non-éveillé.
        const ownedUnit = myMonsters.find(unit => 
          unit.unit_master_id === monsterType.fields.com2us_id || (unawakenedId && unit.unit_master_id === unawakenedId)
        );

        // On passe les données de l'unité si elle est trouvée, sinon on passe null
        const cardHtml = createMonsterCard(monsterType, ownedUnit || null);
        showMonsterInModal(cardHtml);
      }
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

      // SIMPLIFICATION : On ne gère plus que l'ouverture du tiroir de droite (stats)
      if (e.target.closest('.jarvis-card-front') || e.target.closest('.jarvis-card-back')) {
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

/**
 * Crée le HTML pour une petite carte de monstre (photo + nom).
 * @param {object} monsterInfo - Les données du monstre depuis allMonsters.
 * @returns {string} Le HTML de la petite carte.
 */
function createSmallMonsterCard(monsterInfo) {
  if (!monsterInfo) return '';

  const { name, image_filename } = monsterInfo.fields;
  const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;

  return `
    <div class="small-monster-card" title="${name}">
      <img src="${imgUrl}" alt="${name}">
      <div class="small-monster-name">${name}</div>
    </div>
  `;
}
/**
 * Affiche les équipes "counter" pour une équipe donnée.
 * @param {number[]} monsterIds - Un tableau des com2us_id des 3 monstres de l'équipe.
 */
function displayCounterTeams(monsterIds) {
  const counterSection = document.getElementById('counter-teams-section');
  const addCounterContainer = document.getElementById('add-counter-container');
  const counterResultContainer = document.getElementById('counter-teams-result');

  // 1. Trouver l'équipe qui correspond aux monstres recherchés.
  // On trie les IDs pour que la comparaison soit indépendante de l'ordre.
  const sortedMonsterIds = [...monsterIds].sort();
  const foundTeam = teamsData.find(team => {
    const teamMonsterIds = team.monsters.map(m => m.monster_id).sort();
    return teamMonsterIds.length === sortedMonsterIds.length && teamMonsterIds.every((id, index) => id === sortedMonsterIds[index]);
  });

  // Si aucune équipe n'est trouvée, on ne fait rien et on s'assure que la section est cachée.
  if (foundTeam) {
    // Gère l'affichage du bouton "Add Counter"
    addCounterContainer.innerHTML = `<button id="add-counter-btn">Add Counter</button>`;
    document.getElementById('add-counter-btn').addEventListener('click', () => openAddCounterModal(foundTeam));

    // 2. Si l'équipe a des counters, on les affiche.
    if (foundTeam.counter && foundTeam.counter.length > 0) {
      const counterTeamsHtml = foundTeam.counter.map(counterInfo => {
        const counterTeamData = teamsData.find(t => t.team_id === counterInfo.team_id);
        if (counterTeamData) {
          return createTeamCard(counterTeamData, counterInfo);
        }
        return '';
      }).join('');
      counterResultContainer.innerHTML = counterTeamsHtml;
    } else {
      // 3. Si pas de counters, on affiche un message.
      counterResultContainer.innerHTML = `<p>Aucun counter trouvé pour cette équipe.</p>`;
    }
    // 4. On affiche la section des counters.
    counterSection.style.display = 'block';
  } else {
    addCounterContainer.innerHTML = '';
    counterResultContainer.innerHTML = '';
    counterSection.style.display = 'none';
  }
}

/**
 * Crée le HTML pour une carte d'équipe.
 * @param {object} teamData - Les données de l'équipe depuis teams.json.
 * @param {object} [counterInfo=null] - Les informations de counter (win/loss).
 * @returns {string} Le HTML de la carte d'équipe.
 */
function createTeamCard(teamData, counterInfo = null) {
  const monsterImagesHtml = teamData.monsters.map(monster => {
    // On trouve le monstre correspondant dans notre base de données complète
    const monsterInfo = allMonsters.find(m => m.fields.com2us_id === monster.monster_id);
    // On utilise la fonction createSmallMonsterCard pour chaque monstre
    return createSmallMonsterCard(monsterInfo);
  }).join('');

  const counterStatsHtml = counterInfo ? `
    <div class="team-counter-stats">
      <span>Win: ${counterInfo.success}</span> | <span>Loss: ${counterInfo.failure}</span>
    </div>
  ` : '';

  return `
    <div class="team-card">
      <div class="team-card-header">
        <h3>${teamData.name}</h3>
        ${counterStatsHtml}
      </div>
      <div class="team-monsters">
        ${monsterImagesHtml}
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
 */
function openAddCounterModal(defenseMonsters) {
  // Crée la modale si elle n'existe pas
  let modal = document.getElementById('add-counter-modal');
  if (modal) modal.remove(); // Supprime l'ancienne pour la recréer

  modal = document.createElement('div');
  modal.id = 'add-counter-modal';
  modal.className = 'modal-overlay';

  // Prévisualisation de l'équipe de défense
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
        <div class="selected-counter-preview">
          <!-- Les monstres sélectionnés pour le counter apparaîtront ici -->
        </div>
      </div>
      <div class="add-counter-modal-footer">
        <button id="cancel-add-counter">Annuler</button>
        <button id="confirm-add-counter">Add</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.classList.add('visible');

  // Logique de la modale
  const counterSearchInput = document.getElementById('counter-search-input');
  const selectedPreview = modal.querySelector('.selected-counter-preview');
  const confirmButton = modal.querySelector('#confirm-add-counter');
  let selectedCounterMonsters = [];

  // Réutilisation de la logique d'autocomplétion (simplifiée pour la modale)
  counterSearchInput.addEventListener('input', () => {
    const query = counterSearchInput.value.trim().toLowerCase();
    const suggestionsContainer = document.getElementById('counter-suggestions-container');
    if (query.length < 2) {
      suggestionsContainer.innerHTML = '';
      return;
    }
    // CORRECTION : On ne suggère pas les monstres déjà sélectionnés.
    const selectedIds = new Set(selectedCounterMonsters.map(m => m.fields.com2us_id));
    const suggestions = allMonsters
      .filter(m => m.fields.is_awakened && !selectedIds.has(m.fields.com2us_id) && strNoAccent(m.fields.name.toLowerCase()).includes(strNoAccent(query)))
      .slice(0, 5);

    suggestionsContainer.innerHTML = suggestions.map(s => 
      `<div class="suggestion-item" data-monster-id="${s.fields.com2us_id}">${s.fields.name}</div>`
    ).join('');
  });

  // Clic sur une suggestion
  modal.querySelector('#counter-suggestions-container').addEventListener('click', e => {
    // CONTRAINTE 1: On vérifie qu'on a moins de 3 monstres sélectionnés.
    if (e.target.classList.contains('suggestion-item') && selectedCounterMonsters.length < 3) { 
      const monsterId = parseInt(e.target.dataset.monsterId, 10);
      const monsterInfo = allMonsters.find(m => m.fields.com2us_id === monsterId);

      // CONTRAINTE 2: On vérifie que le monstre n'est pas déjà dans la sélection.
      const isAlreadySelected = selectedCounterMonsters.some(m => m.fields.com2us_id === monsterId);
      if (monsterInfo && !isAlreadySelected) {
        selectedCounterMonsters.push(monsterInfo);
        updateCounterPreview();
        counterSearchInput.value = '';
        document.getElementById('counter-suggestions-container').innerHTML = '';
      }
    }
  });

  function updateCounterPreview() {
    selectedPreview.innerHTML = selectedCounterMonsters.map(m => createSmallMonsterCard(m)).join('');
    // Met à jour l'état du bouton "Add"
    updateAddButtonState();
  }

  function updateAddButtonState() {
    // Active le bouton uniquement si 3 monstres sont sélectionnés
    confirmButton.disabled = selectedCounterMonsters.length !== 3;
  }

  // Gestion des boutons
  updateAddButtonState(); // Désactive le bouton au démarrage
  modal.querySelector('#cancel-add-counter').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => {
    if (e.target.id === 'add-counter-modal') modal.remove();
  });

  modal.querySelector('#confirm-add-counter').addEventListener('click', () => {
    if (selectedCounterMonsters.length > 0) {
      // NOTE : Cette logique met à jour les données en mémoire.
      // Les changements seront perdus au rechargement de la page.
      // Une future étape pourrait être de sauvegarder ces données.
      
      // Pour l'instant, on simule l'ajout et on rafraîchit l'affichage.
      console.log("Nouveau counter à ajouter :", selectedCounterMonsters.map(m => m.fields.name).join(', '));
      console.log("Pour la défense :", defenseMonsters.map(m => m.fields.name).join(', '));
      alert("Fonctionnalité d'ajout en cours de développement ! Le counter a été loggué en console.");
      modal.remove();
      // Ici, il faudrait ajouter le nouveau counter à `teamsData` et rappeler `displayCounterTeams`.
    }
  });
}