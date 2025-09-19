/* tada*/
document.getElementById('searchBtn').addEventListener('click', searchMonster);

document.getElementById('searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') searchMonster();
});

function searchMonster() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!query) {
    showResult("Veuillez entrer le nom d'un monstre.");
    return;
  }

  fetch('bestiary_data.json')
    .then(response => response.json())
    .then(data => {
      // Filtre sur les monstres uniquement
      const monsters = data.filter(obj => obj.model === "bestiary.monster");
      // Recherche par nom (case insensitive)
      const monster = monsters.find(m => m.fields.name.toLowerCase() === query);

      if (!monster) {
        showResult("Aucun monstre trouvé pour ce nom.");
        return;
      }


      // Construction de l'URL de l'image Swarfarm de manière plus fiable
      // La méthode que vous utilisez dans votre nouveau fichier est la meilleure :
      const imgUrl = `https://swarfarm.com/static/herders/images/monsters/${monster.fields.image_filename}`;

      showResult(`
        <h2>${monster.fields.name}</h2>
        <img src="${imgUrl}" alt="${monster.fields.name}" style="max-width: 100px;">
      `);
    })
    .catch(err => {
      showResult("Erreur lors du chargement des données du bestiaire.");
      console.error(err);
    });
}

function showResult(html) {
  document.getElementById('result').innerHTML = html;
}
