/* tada*/
let allMonsters = []; // Stocker les monstres ici

// Charger les données une seule fois au démarrage
window.addEventListener('DOMContentLoaded', () => {
  fetch('bestiary_data.json')
    .then(response => response.json())
    .then(data => {
      allMonsters = data.filter(obj => obj.model === "bestiary.monster");
    })
    .catch(err => {
      console.error("Erreur lors du chargement des données du bestiaire.", err);
      showResult("Impossible de charger les données des monstres.");
    });
});

document.getElementById('searchBtn').addEventListener('click', searchMonster);
document.getElementById('resetBtn').addEventListener('click', resetSearch);

document.getElementById('searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    clearSuggestions();
    searchMonster();
  } else if (e.key === 'Escape') {
    resetSearch(); // Utilise resetSearch pour tout effacer
  }
});

function searchMonster() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) {
    showResult("Veuillez entrer le nom d'un ou plusieurs monstres.");
    return;
  }

  // Sépare les termes de recherche, nettoie et supprime les doublons
  const searchTerms = [...new Set(query.split(' ').map(term => term.trim().toLowerCase()).filter(term => term))];

  // Trouve tous les monstres correspondants aux termes de recherche
  const foundMonsters = searchTerms.map(term => {
    return allMonsters.find(m => m.fields.name.toLowerCase() === term);
  }).filter(Boolean); // Retire les résultats non trouvés (undefined)

  if (foundMonsters.length === 0) {
    showResult("Aucun des monstres recherchés n'a été trouvé.");
    return;
  }

  // Construit une carte HTML pour chaque monstre trouvé
  const cardsHtml = foundMonsters.map(monster => {
    const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${monster.fields.image_filename}`;
    return `
      <div class="monster-card">
        <h2>${monster.fields.name}</h2>
        <img src="${imgUrl}" alt="${monster.fields.name}">
      </div>
    `;
  }).join('');

  // Affiche les cartes dans un conteneur
  showResult(`<div class="results-container">${cardsHtml}</div>`);
}

// --- Logique d'autocomplétion ---

const searchInput = document.getElementById('searchInput');
const suggestionsContainer = document.getElementById('suggestions-container');

searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  const words = query.split(' ');
  const currentWord = words[words.length - 1].trim().toLowerCase();
  // Récupère les noms déjà tapés pour ne pas les suggérer à nouveau
  const existingNames = new Set(words.slice(0, -1).map(w => w.trim().toLowerCase()));

  if (currentWord.length === 0) {
    clearSuggestions();
    return;
  }

  const suggestions = allMonsters
    .filter(m => {
      const monsterNameLower = m.fields.name.toLowerCase();
      // Suggère seulement si le nom commence par le mot actuel ET n'est pas déjà dans la recherche
      return monsterNameLower.startsWith(currentWord) && !existingNames.has(monsterNameLower);
    })
    .slice(0, 5);

  if (suggestions.length > 0) {
    suggestionsContainer.innerHTML = suggestions.map(s =>
      `<div class="suggestion-item">${s.fields.name}</div>`
    ).join('');

    // Ajoute des écouteurs de clic sur les nouvelles suggestions
    document.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', () => {
        const baseQuery = words.slice(0, -1).join(' ');
        searchInput.value = (baseQuery ? baseQuery + ' ' : '') + item.textContent + ' ';
        clearSuggestions();
        searchInput.focus();
      });
    });
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

function clearSuggestions() {
  suggestionsContainer.innerHTML = '';
}

function showResult(html) {
  document.getElementById('result').innerHTML = html;
}

function resetSearch() {
  searchInput.value = '';
  showResult('');
  clearSuggestions();
}
