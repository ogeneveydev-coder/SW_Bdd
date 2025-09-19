/* tada*/
document.getElementById('searchBtn').addEventListener('click', searchMonster);
document.getElementById('resetBtn').addEventListener('click', resetSearch);

document.getElementById('searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    searchMonster();
  } else if (e.key === 'Escape') {
    document.getElementById('searchInput').value = '';
  }
});

function searchMonster() {
  const query = document.getElementById('searchInput').value.trim();
  if (!query) {
    showResult("Veuillez entrer le nom d'un ou plusieurs monstres.");
    return;
  }

  // Sépare les termes de recherche par des espaces et les nettoie
  const searchTerms = query.split(' ').map(term => term.trim().toLowerCase()).filter(term => term);

  fetch('bestiary_data.json')
    .then(response => response.json())
    .then(data => {
      // Filtre sur les monstres uniquement
      const allMonsters = data.filter(obj => obj.model === "bestiary.monster");

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
    })
    .catch(err => {
      showResult("Erreur lors du chargement des données du bestiaire.");
      console.error(err);
    });
}

function showResult(html) {
  document.getElementById('result').innerHTML = html;
}

function resetSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('result').innerHTML = '';
}
