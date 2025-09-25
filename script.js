/* tada*/

// --- GESTION DES VERSIONS ---
// Mettez à jour ces valeurs lorsque vous modifiez un fichier.
const fileVersions = {
  script: '2.6',
  style: '2.6',
  index: '2.1'
};
const allMonsters = [];
let globalMonsterStats = {}; // Stockera les stats min/avg/max de tous les monstres

// Centraliser les sélecteurs DOM pour la performance et la lisibilité
const searchInput = document.getElementById('searchInput');
const resultContainer = document.getElementById('result');
const suggestionsContainer = document.getElementById('suggestions-container');
const searchBtn = document.getElementById('searchBtn');
const resetBtn = document.getElementById('resetBtn');

// Charger les données une seule fois au démarrage
window.addEventListener('DOMContentLoaded', () => {
  displayFileVersions(); // Affiche les versions au chargement

  fetch('bestiary_data.json')
    .then(response => response.json())
    .then(data => {
      // Filtre pour ne garder que les monstres 2 à 6 étoiles
      const filteredMonsters = data.filter(obj => 
        obj.model === "bestiary.monster" && obj.fields.natural_stars >= 2
      );
      allMonsters.push(...filteredMonsters);

      // Pré-calcule les statistiques globales sur tous les monstres filtrés
      const stats = {
        hp:  allMonsters.map(m => m.fields.base_hp),
        atk: allMonsters.map(m => m.fields.base_attack),
        def: allMonsters.map(m => m.fields.base_defense),
        spd: allMonsters.map(m => m.fields.speed),
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
      };

    })
    .catch(err => {
      console.error("Erreur lors du chargement des données du bestiaire.", err);
      showResult("Impossible de charger les données des monstres.");
    });

  // Ajoute un écouteur de clic sur le conteneur de résultats pour gérer la rotation des cartes
  resultContainer.addEventListener('click', function(e) {
    const card = e.target.closest('.jarvis-card');
    if (card) {
      card.classList.toggle('is-flipped');
    }
  });
});

searchBtn.addEventListener('click', searchMonster);
resetBtn.addEventListener('click', resetSearch);

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    clearSuggestions();
    searchMonster();
  } else if (e.key === 'Escape') {
    resetSearch(); // Utilise resetSearch pour tout effacer
  }
});

function searchMonster() {
  const query = searchInput.value.trim();
  if (!query) {
    showResult("Veuillez entrer le nom d'un ou plusieurs monstres.");
    return;
  }

  // Sépare les termes de recherche, nettoie et supprime les doublons
  const searchTerms = [...new Set(query.split(' ').map(term => strNoAccent(term.trim().toLowerCase())).filter(term => term))];

  // Trouve tous les monstres correspondants aux termes de recherche
  const foundMonsters = searchTerms.map(term => {
    return allMonsters.find(m => strNoAccent(m.fields.name.toLowerCase()) === term);
  }).filter(Boolean); // Retire les résultats non trouvés (undefined)

  if (foundMonsters.length === 0) {
    showResult("Aucun des monstres recherchés n'a été trouvé.");
    return;
  }

  // Génère le HTML pour les statistiques globales (min/avg/max)
  // Ce bloc sera maintenant toujours affiché.
  const comparativeStatsHtml = `
    <div class="comparative-stats">
      <p><span>HP:</span> ${globalMonsterStats.hp.min} / <span>${globalMonsterStats.hp.avg}</span> / ${globalMonsterStats.hp.max}</p>
      <p><span>ATK:</span> ${globalMonsterStats.atk.min} / <span>${globalMonsterStats.atk.avg}</span> / ${globalMonsterStats.atk.max}</p>
      <p><span>DEF:</span> ${globalMonsterStats.def.min} / <span>${globalMonsterStats.def.avg}</span> / ${globalMonsterStats.def.max}</p>
      <p><span>SPD:</span> ${globalMonsterStats.spd.min} / <span>${globalMonsterStats.spd.avg}</span> / ${globalMonsterStats.spd.max}</p>
    </div>
  `;

  // Construit une carte HTML pour chaque monstre trouvé
  const cardsHtml = foundMonsters.map(monster => {
    const { name, element, archetype, base_hp, base_attack, base_defense, speed, image_filename } = monster.fields;
    const statRings = createStatRingsSVG(monster.fields);
    const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${image_filename}`;
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
                    ${statRings}
                    <img src="${imgUrl}" alt="${name}">
                </div>
                <div class="jarvis-name">${name}</div>
            </div>
          </div>
          <!-- Face Arrière -->
          <div class="jarvis-card-back">
            <div class="jarvis-corner top-left"></div>
            <div class="jarvis-corner top-right"></div>
            <div class="jarvis-corner bottom-left"></div>
            <div class="jarvis-corner bottom-right"></div>
            <div class="jarvis-stats">
                <div class="jarvis-name">${name}</div>
                <p><span>Element:</span> ${element}</p>
                <p><span>Archetype:</span> ${archetype}</p>
                <p><span>HP:</span> ${base_hp} | <span>ATK:</span> ${base_attack}</p>
                <p><span>DEF:</span> ${base_defense} | <span>SPD:</span> ${speed}</p>
                ${comparativeStatsHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Affiche les cartes dans un conteneur
  showResult(`<div class="results-container">${cardsHtml}</div>`);

  // Déclenche l'animation des anneaux après que le DOM a été mis à jour
  // setTimeout avec 0ms force le navigateur à attendre le prochain "tick" de rendu
  requestAnimationFrame(() => {
    document.querySelectorAll('.stat-ring').forEach(ring => {
      const finalOffset = ring.dataset.finalOffset;
      ring.style.strokeDashoffset = finalOffset;
    });
  });
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

function createStatRingsSVG(stats) {
  const { base_hp, base_attack, base_defense, speed } = stats;

  // Valeurs maximales de référence pour calculer les pourcentages
  const MAX_STATS = { hp: 20000, atk: 1000, def: 1000, spd: 135 };

  // Configuration de chaque anneau (rayon et classe CSS)
  const STAT_CONFIG = [
    { name: 'hp',  value: base_hp,      radius: 78, class: 'stat-hp' },
    { name: 'atk', value: base_attack,  radius: 72, class: 'stat-atk' },
    { name: 'def', value: base_defense, radius: 66, class: 'stat-def' },
    { name: 'spd', value: speed,        radius: 60, class: 'stat-spd' }
  ];

  const rings = STAT_CONFIG.map(stat => {
    const max = MAX_STATS[stat.name];
    const percentage = Math.min(stat.value / max, 1); // Plafonne à 100%
    const circumference = 2 * Math.PI * stat.radius;
    const finalOffset = circumference * (1 - percentage);

    return `
      <circle class="stat-ring-bg" cx="80" cy="80" r="${stat.radius}"></circle>
      <circle 
        class="stat-ring ${stat.class}"
        cx="80" cy="80" 
        r="${stat.radius}" 
        style="--circumference: ${circumference};"
        data-final-offset="${finalOffset}">
      </circle>
    `;
  }).join('');

  return `<svg class="stat-rings" viewBox="0 0 160 160">${rings}</svg>`;
}