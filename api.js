/**
 * api.js 
 * Module pour gérer toutes les communications avec le serveur (API).
 */

/**
 * Charge toutes les données initiales de l'application (bestiaire, monstres du joueur, équipes).
 * @returns {Promise<[object[], object|null, object[]]>} Une promesse qui résout avec les données.
 */
export async function loadInitialData() {
    const [bestiaryData, myBestiaryData, loadedTeamsData] = await Promise.all([
        fetch('bestiary_data.json').then(res => res.json()),
        fetch('my_bestiary.json').then(res => res.json()).catch(err => {
            console.warn("Fichier my_bestiary.json non trouvé ou invalide. La section 'Mes Monstres' sera vide.", err);
            return null;
        }),
        fetch('/api/teams').then(res => res.json()).catch(err => { // On appelle notre API serveur
            console.warn("Fichier teams.json non trouvé ou invalide.", err);
            return [];
        })
    ]);
    return [bestiaryData, myBestiaryData, loadedTeamsData];
}

/**
 * Sauvegarde l'état actuel du tableau teamsData sur le serveur.
 * @param {object[]} teamsData - L'array complet des données des équipes.
 */
export async function saveTeamsDataToServer(teamsData) {
    const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamsData),
    });
    const result = await response.json();
    console.log("Réponse du serveur:", result);
}