/* tada*/

// --- GESTION DES VERSIONS ---
// Mettez à jour ces valeurs lorsque vous modifiez un fichier.
const fileVersions = {
  script: '2.23',
  style: '2.23',
  index: '2.1'
};
const allMonsters = [];
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

  fetch('bestiary_data.json')
    .then(response => response.json())
    .then(data => {
      // Filtre pour ne garder que les monstres 2 à 6 étoiles
      const filteredMonsters = data.filter(obj =>
        obj.model === "bestiary.monster" &&
        obj.fields.natural_stars >= 2 && obj.fields.is_awakened
      );
      allMonsters.push(...filteredMonsters);

      // Pré-calcule les statistiques globales sur tous les monstres filtrés
      const stats = {
        hp:  allMonsters.map(m => m.fields.base_hp),
        atk: allMonsters.map(m => m.fields.base_attack),
        def: allMonsters.map(m => m.fields.base_defense),
        spd: allMonsters.map(m => m.fields.speed),
        cr:  allMonsters.map(m => m.fields.crit_rate),
        cd:  allMonsters.map(m => m.fields.crit_damage),
        res: allMonsters.map(m => m.fields.resistance),
        acc: allMonsters.map(m => m.fields.accuracy),
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
    <div class="comparative-stats" style="font-size: 0.6em;">
      <p><span>HP:</span> ${globalMonsterStats.hp.min} / <span>${globalMonsterStats.hp.avg}</span> / ${globalMonsterStats.hp.max}</p>
      <p><span>ATK:</span> ${globalMonsterStats.atk.min} / <span>${globalMonsterStats.atk.avg}</span> / ${globalMonsterStats.atk.max}</p>
      <p><span>DEF:</span> ${globalMonsterStats.def.min} / <span>${globalMonsterStats.def.avg}</span> / ${globalMonsterStats.def.max}</p>
      <p><span>SPD:</span> ${globalMonsterStats.spd.min} / <span>${globalMonsterStats.spd.avg}</span> / ${globalMonsterStats.spd.max}</p>
      <p><span>CR:</span> ${globalMonsterStats.cr.min}% / <span>${globalMonsterStats.cr.avg}%</span> / ${globalMonsterStats.cr.max}%</p>
      <p><span>CD:</span> ${globalMonsterStats.cd.min}% / <span>${globalMonsterStats.cd.avg}%</span> / ${globalMonsterStats.cd.max}%</p>
      <p><span>RES:</span> ${globalMonsterStats.res.min}% / <span>${globalMonsterStats.res.avg}%</span> / ${globalMonsterStats.res.max}%</p>
      <p><span>ACC:</span> ${globalMonsterStats.acc.min}% / <span>${globalMonsterStats.acc.avg}%</span> / ${globalMonsterStats.acc.max}%</p>
    </div>
  `;

  // Construit une carte HTML pour chaque monstre trouvé
  const cardsHtml = foundMonsters.map(monster => {
    const { name, element, archetype, base_hp, base_attack, base_defense, speed, crit_rate, crit_damage, resistance, accuracy, image_filename } = monster.fields;
    const statRings = createStatRingsSVG(monster.fields);
    const radialChart = createRadialBarChart(monster.fields);
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
                <div class="jarvis-name">${name}</div>
                <p><span>Element:</span> ${element}</p>
                <p><span>Archetype:</span> ${archetype}</p>
                <p><span>HP:</span> ${base_hp} | <span>ATK:</span> ${base_attack}</p>
                <p><span>DEF:</span> ${base_defense} | <span>SPD:</span> ${speed}</p>
                <p><span>CR:</span> ${crit_rate}% | <span>CD:</span> ${crit_damage}%</p>
                <p><span>RES:</span> ${resistance}% | <span>ACC:</span> ${accuracy}%</p>
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

function createStatMarkers(stat) {
  const { name, radius } = stat;
  const max = MAX_STATS[name];
  const globalStat = globalMonsterStats[name];
  let markersHtml = '';

  const markerConfigs = [
    { value: globalStat.min, class: 'stat-marker-min' },
    { value: globalStat.avg, class: 'stat-marker-avg' },
    { value: globalStat.max, class: 'stat-marker-max' }
  ];

  markerConfigs.forEach(marker => {
    const percentage = marker.value / max;
    const angle = (percentage * 2 * Math.PI) - (Math.PI / 2);

    if (marker.class === 'stat-marker-avg') {
      // Dessine une ligne radiale pour la moyenne
      const innerRadius = radius - 4;
      const outerRadius = radius + 4;
      const x1 = 80 + innerRadius * Math.cos(angle);
      const y1 = 80 + innerRadius * Math.sin(angle);
      const x2 = 80 + outerRadius * Math.cos(angle);
      const y2 = 80 + outerRadius * Math.sin(angle);
      markersHtml += `<line class="stat-marker ${marker.class}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"></line>`;
    } else {
      // Dessine un cercle pour le min et le max
      const cx = 80 + radius * Math.cos(angle);
      const cy = 80 + radius * Math.sin(angle);
      markersHtml += `<circle class="stat-marker ${marker.class}" cx="${cx}" cy="${cy}" r="2"></circle>`;
    }
  });

  return markersHtml;
}

function createStatRingsSVG(stats) {
  const { base_hp, base_attack, base_defense, speed } = stats;

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
    const markers = createStatMarkers(stat);

    return `
      <circle class="stat-ring-bg" cx="80" cy="80" r="${stat.radius}"></circle>
      <circle 
        class="stat-ring ${stat.class}"
        cx="80" cy="80" 
        r="${stat.radius}" 
        style="--circumference: ${circumference};"
        data-final-offset="${finalOffset}">
      </circle>
      ${markers}
    `;
  }).join('');

  return `<svg class="stat-rings" viewBox="0 0 160 160">${rings}</svg>`;
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
    chartHtml += `<path class="avg-marker" d="${describeSector(center.x, center.y, avgRadius, startAngle, endAngle)}"></path>`;

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