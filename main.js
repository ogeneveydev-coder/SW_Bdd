/**
 * main.js 
 * Fichier principal de l'application, orchestrant les modules api.js et ui.js.
 */

import { loadInitialData, saveTeamsDataToServer } from './api.js';
import {
    searchInput, resultContainer, suggestionsContainer, searchBtn, resetBtn, drawerHandle,
    createMonsterCard, clearSuggestions, showResult, displayFileVersions,
    initializeBestiaryViews, showMonsterInModal, createTeamCard, getTeamPerformanceStats,
    openAddCounterModal as openAddCounterModalUI,
    displayCounterTeams as displayCounterTeamsUI,
    closeBestiaryDrawer
} from './ui.js';

// --- GESTION DES VERSIONS ---
const fileVersions = {
  script: '4.4.1', // Distinction carte/fiche
  style: '2.43', // Distinction carte/fiche
  index: '2.17'
};

// --- VARIABLES GLOBALES DE L'APPLICATION ---
export let allMonsters = [];
export let awakenedMonsters = [];
export let myMonsters = [];
export let ownedMonsterIds = new Set();
export let globalMonsterStats = {};
export let monsterMetaStats = {}; // Pour les stats de présence et de winrate par monstre
export let teamsData = [];
let currentCounterView = 'counters'; // 'counters' ou 'counterOf'

export const MAX_STATS = { 
  hp: 20000, atk: 1000, def: 1000, spd: 135,
  cr: 100, cd: 100, res: 100, acc: 100
};

// --- INITIALISATION DE L'APPLICATION ---
window.addEventListener('DOMContentLoaded', async () => {
  displayFileVersions(fileVersions);

  try {
    const [bestiaryData, myBestiaryData, loadedTeamsData] = await loadInitialData();

    const allRelevantMonsters = bestiaryData.filter(obj => obj.model === "bestiary.monster" && obj.fields.natural_stars >= 2);
    allMonsters.push(...allRelevantMonsters);

    awakenedMonsters = allMonsters.filter(m => m.fields.is_awakened);

    if (myBestiaryData && myBestiaryData.unit_list) {
      myMonsters = myBestiaryData.unit_list;
      ownedMonsterIds = new Set(myMonsters.map(m => m.unit_master_id));
    }

    teamsData = loadedTeamsData;

    calculateGlobalStats();
    initializeBestiaryViews();
    calculateMonsterMetaStats(); // Calcul des nouvelles stats par monstre
    setupEventListeners();
    // searchInput.addEventListener('input', handleAutocomplete); // On le déplace dans setupEventListeners

  } catch (err) {
    console.error("Erreur lors de l'initialisation de l'application.", err);
    showResult("Impossible de charger les données de l'application.");
  }

  // On appelle cette fonction ici, après que le bloc try/catch a terminé et que toutes les données sont prêtes.
  // La fonction calcule les stats et les prépare, mais ne les affiche plus directement.
  calculateMetaStats();
});

function calculateGlobalStats() {
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
        hp:  calc(stats.hp), atk: calc(stats.atk), def: calc(stats.def),
        spd: calc(stats.spd), cr:  calc(stats.cr),  cd:  calc(stats.cd),
        res: calc(stats.res), acc: calc(stats.acc),
    };
}

/**
 * Calcule les statistiques de méta pour chaque monstre (présence, winrate, etc.).
 */
function calculateMonsterMetaStats() {
    // Initialisation
    allMonsters.forEach(monster => {
        monsterMetaStats[monster.fields.com2us_id] = {
            presenceCount: 0,
            defenseAppearances: 0,
            defenseWins: 0,
            defenseLosses: 0,
            attackAppearances: 0,
            attackWins: 0,
            attackLosses: 0
        };
    });

    if (teamsData.length === 0) return;

    // Itération sur toutes les équipes pour collecter les données
    teamsData.forEach(team => {
        const teamMonsterIds = team.monsters.map(m => m.monster_id);

        // 1. Calcul pour la présence en défense
        teamMonsterIds.forEach(monsterId => {
            if (monsterMetaStats[monsterId]) {
                monsterMetaStats[monsterId].presenceCount++;
                monsterMetaStats[monsterId].defenseAppearances++;
                // Les victoires d'une défense sont les échecs de ses counters
                const wins = team.counter.reduce((acc, c) => acc + c.failure, 0);
                const losses = team.counter.reduce((acc, c) => acc + c.success, 0);
                monsterMetaStats[monsterId].defenseWins += wins;
                monsterMetaStats[monsterId].defenseLosses += losses;
            }
        });

        // 2. Calcul pour la présence en attaque (en tant que counter)
        teamsData.forEach(defenseTeam => {
            defenseTeam.counter.forEach(counterInfo => {
                if (counterInfo.team_id === team.team_id) { // Si 'team' est un counter de 'defenseTeam'
                    teamMonsterIds.forEach(monsterId => {
                        if (monsterMetaStats[monsterId]) {
                            monsterMetaStats[monsterId].attackAppearances++;
                            monsterMetaStats[monsterId].attackWins += counterInfo.success;
                            monsterMetaStats[monsterId].attackLosses += counterInfo.failure;
                        }
                    });
                }
            });
        });
    });
}

function setupEventListeners() {
    drawerHandle.addEventListener('click', () => {
        const drawer = document.getElementById('bestiary-section');
        const isOpen = drawer.classList.toggle('is-open');
        drawerHandle.textContent = isOpen ? '‹' : '›';
    });

    const statsDrawer = document.getElementById('stats-section');
    const statsDrawerHandle = document.getElementById('stats-drawer-handle');
    statsDrawerHandle.addEventListener('click', () => {
        const isOpen = statsDrawer.classList.toggle('is-open');
        statsDrawerHandle.textContent = isOpen ? '›' : '‹';
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearSuggestions();
            searchMonster();
        } else if (e.key === 'Escape') {
            resetSearch();
        }
    });

    searchBtn.addEventListener('click', () => searchMonster());
    resetBtn.addEventListener('click', resetSearch);

    resultContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-btn')) {
            const monsterNameToRemove = e.target.dataset.monsterName;
            if (!monsterNameToRemove) return;

            const currentSearch = searchInput.value.split(' ');
            const nameToRemove = strNoAccent(monsterNameToRemove.toLowerCase());
            const indexToRemove = currentSearch.findIndex(term => strNoAccent(term.toLowerCase()) === nameToRemove);

            if (indexToRemove > -1) {
                currentSearch.splice(indexToRemove, 1);
                searchInput.value = currentSearch.join(' ').trim() + ' ';
                searchMonster();
            }
        }
    });

    searchInput.addEventListener('input', handleAutocomplete);

    // Gestion des clics sur les boutons Win/Loss
    document.getElementById('counter-teams-result').addEventListener('click', e => {
        if (e.target.classList.contains('win-btn')) {
            const counterTeamId = e.target.dataset.counterTeamId;
            const defenseTeamId = e.target.dataset.defenseTeamId;
            updateCounterStats(defenseTeamId, counterTeamId, 'success');
        } else if (e.target.classList.contains('loss-btn')) {
            const counterTeamId = e.target.dataset.counterTeamId;
            const defenseTeamId = e.target.dataset.defenseTeamId;
            updateCounterStats(defenseTeamId, counterTeamId, 'failure');
        } else if (e.target.classList.contains('delete-team-btn')) {
            const teamCard = e.target.closest('.team-card');
            const teamIdToDelete = teamCard.dataset.teamId;
            if (confirm("Êtes-vous sûr de vouloir supprimer cette équipe ? Cette action est irréversible.")) {
                deleteTeam(teamIdToDelete);
            }
        }
    });

    searchInput.addEventListener('input', handleAutocomplete);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            clearSuggestions();
        }
    });

    suggestionsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('suggestion-item')) {
            const words = searchInput.value.split(' ');
            const baseQuery = words.slice(0, -1).join(' ');
            searchInput.value = (baseQuery ? baseQuery + ' ' : '') + e.target.textContent + ' ';
            clearSuggestions();
            searchInput.focus();
        }
    });
}

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

    let monsterType = allMonsters.find(m => m.fields.com2us_id === specificMonster.unit_master_id);
    if (!monsterType) return;

    while (monsterType.fields.awakens_to) {
      const nextForm = allMonsters.find(m => m.pk === monsterType.fields.awakens_to);
      if (nextForm && nextForm.fields.name !== monsterType.fields.name) {
        monsterType = nextForm;
      } else {
        break;
      }
    }
    
    if (monsterType) {
      const cardHtml = createMonsterCard(monsterType, specificMonster);
      showMonsterInModal(cardHtml);
    }
    return;
  }

  const searchTerms = query.split(' ').map(term => strNoAccent(term.trim().toLowerCase())).filter(Boolean);
  const foundMonsters = [];

  for (const term of searchTerms) {
    const familyMatches = allMonsters.filter(m => !m.fields.is_awakened && strNoAccent(m.fields.name.toLowerCase()) === term);
    const isFamilyName = new Set(familyMatches.map(m => m.fields.element)).size > 1;

    if (isFamilyName) continue;

    for (const monster of allMonsters) {
      if (strNoAccent(monster.fields.name.toLowerCase()) === term) {
        let monsterToShow = monster;
        while (monsterToShow.fields.awakens_to) {
          const nextForm = allMonsters.find(m => m.pk === monsterToShow.fields.awakens_to);
          if (nextForm && nextForm.fields.name !== monsterToShow.fields.name) {
            monsterToShow = nextForm;
          } else {
            break;
          }
        }
        if (monsterToShow) {
          foundMonsters.push(monsterToShow);
        }
        break;
      }
    }
  }

  if (foundMonsters.length === 0) {
    showResult("Aucun des monstres recherchés n'a été trouvé.");
    return;
  }

  const counterSection = document.getElementById('counter-teams-section');
  const addCounterContainer = document.getElementById('add-counter-container');
  const counterResultContainer = document.getElementById('counter-teams-result');

  if (foundMonsters.length === 3) {
    currentCounterView = 'counters'; // Réinitialise la vue par défaut à chaque nouvelle recherche
    // On affiche les cartes individuelles des monstres recherchés.
    const cardsHtml = foundMonsters.map(monster => createMonsterCard(monster)).join('');
    showResult(`<div class="results-container">${cardsHtml}</div>`);

    // On affiche les counters existants pour cette équipe
    displayCounterTeams(foundMonsters.map(m => m.fields.com2us_id));
    displayMetaStats(); // Affiche le rapport de méta dans le tiroir
    counterSection.style.display = 'block';
    document.getElementById('stats-drawer-handle').style.display = 'flex'; // Affiche la poignée du tiroir stats
  } else {
    // Si moins de 3 monstres, on affiche leurs cartes individuelles.
    const cardsHtml = foundMonsters.map(monster => createMonsterCard(monster)).join('');
    showResult(`<div class="results-container">${cardsHtml}</div>`);
    counterSection.style.display = 'none';
    document.getElementById('stats-drawer-handle').style.display = 'none'; // Cache la poignée
    document.getElementById('stats-section').classList.remove('is-open'); // Ferme le tiroir
  }
}

function handleAutocomplete() {
    const query = searchInput.value;
    const words = query.split(' ');
    const currentWord = words[words.length - 1].trim().toLowerCase();
    const existingNames = new Set(words.slice(0, -1).map(w => strNoAccent(w.trim().toLowerCase())));

    if (currentWord.length === 0) {
        clearSuggestions();
        return;
    }
    const normalizedCurrentWord = strNoAccent(currentWord);

    const matchingNames = [...new Set(allMonsters
        .filter(m => strNoAccent(m.fields.name.toLowerCase()).startsWith(normalizedCurrentWord))
        .map(m => m.fields.name)
    )];

    const suggestions = matchingNames.filter(name => {
        const normalizedName = strNoAccent(name.toLowerCase());
        const familyMatches = allMonsters.filter(m => !m.fields.is_awakened && strNoAccent(m.fields.name.toLowerCase()) === normalizedName);
        const isFamilyName = new Set(familyMatches.map(m => m.fields.element)).size > 1;
        return !existingNames.has(normalizedName) && !isFamilyName;
    }).slice(0, 5);

    if (suggestions.length > 0) {
        suggestionsContainer.innerHTML = suggestions.map(s => `<div class="suggestion-item">${s}</div>`).join('');
    } else {
        clearSuggestions();
    }
}

function resetSearch() {
  searchInput.value = '';
  showResult('');
  clearSuggestions();
  document.getElementById('counter-teams-section').style.display = 'none';
  document.getElementById('stats-drawer-handle').style.display = 'none';
}

function strNoAccent(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function openAddCounterModal(defenseMonsters, defenseTeamId) {
    const onConfirmCallback = (selectedCounterMonsters) => {
        // 1. On trouve l'équipe de défense qui doit déjà exister.
        const defenseTeam = teamsData.find(t => t.team_id === defenseTeamId);
        
        // 2. On trouve ou on crée l'équipe "counter" à partir des monstres sélectionnés.
        const counterTeam = findOrCreateTeam(selectedCounterMonsters);

        if (defenseTeam && counterTeam) {
            // 3. On vérifie si ce counter n'est pas déjà lié.
            const existingCounterLink = defenseTeam.counter.find(c => c.team_id === counterTeam.team_id);

            if (!existingCounterLink) {
                // 4. On ajoute le lien du counter à l'équipe de défense.
                defenseTeam.counter.push({ team_id: counterTeam.team_id, success: 0, failure: 0, defense_team_id: defenseTeam.team_id });
                // 5. On sauvegarde l'état complet des données.
                saveTeamsDataToServer(teamsData);
            }
        }
        // 6. On rafraîchit l'affichage pour voir le nouveau counter.
        displayCounterTeams(defenseMonsters.map(m => m.fields.com2us_id));
    };
    // On passe le callback à la fonction UI
    openAddCounterModalUI(defenseMonsters, onConfirmCallback, strNoAccent);
}

let metaStats = {}; // Variable pour stocker les stats calculées

/**
 * Calcule les statistiques globales (méta) des équipes et les stocke.
 */
function calculateMetaStats() {
    // 1. Top 5 des Défenses les plus Populaires (celles qui sont le plus attaquées)
    const defensePopularity = teamsData.map(team => {
        const stats = getTeamPerformanceStats(team, teamsData);
        return { team, count: stats.defenseAttacks };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

    // 2. Top 5 des Défenses les plus Solides (par win rate en défense)
    const defensePerformance = teamsData.map(team => {
        const stats = getTeamPerformanceStats(team, teamsData);
        return { team, winRate: stats.defenseWinRate, defenseAttacks: stats.defenseAttacks };
    })
    .filter(item => item.defenseAttacks > 5) // On ne considère que les défenses attaquées plus de 5 fois pour la pertinence
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);

    // 3. Top 5 des Counters les plus Fiables (par win rate en attaque)
    const counterPerformance = teamsData.map(team => {
        const stats = getTeamPerformanceStats(team, teamsData);
        return { team, winRate: stats.attackSuccessRate, totalUses: stats.attackUses };
    })
    .filter(item => item.totalUses > 5) // On ne considère que les counters utilisés plus de 5 fois
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);
    
    metaStats = { defensePopularity, defensePerformance, counterPerformance };
}

/**
 * Affiche les statistiques de méta pré-calculées.
 */
function displayMetaStats() {
    const metaStatsContainer = document.getElementById('meta-report-container');
    if (!metaStatsContainer) return;

    const { defensePopularity, defensePerformance, counterPerformance } = metaStats;
    if (!defensePopularity) return; // Les stats ne sont pas prêtes

    let metaHtml = `<h2 class="section-title">Rapport de Méta</h2>`;

    const createListHtml = (title, items, formatter) => {
        let listHtml = `<div class="meta-section"><h3>${title}</h3><ul>`;
        if (items.length > 0) {
            items.forEach(item => {
                listHtml += `<li>${formatter(item)}</li>`;
            });
        } else {
            listHtml += `<li>Pas assez de données.</li>`;
        }
        listHtml += `</ul></div>`;
        return listHtml;
    };

    metaHtml += createListHtml(
        'Défenses les plus Populaires', 
        defensePopularity,
        item => `${item.team.name} (${item.count} attaques subies)`
    );
    metaHtml += createListHtml(
        'Défenses les plus Solides', 
        defensePerformance,
        item => `${item.team.name} (${item.winRate}% victoires / ${item.defenseAttacks} attaques)`
    );
    metaHtml += createListHtml(
        'Counters les plus Fiables', 
        counterPerformance,
        item => `${item.team.name} (${item.winRate}% succès / ${item.totalUses} utilisations)`
    );

    metaStatsContainer.innerHTML = `<div class="meta-report-card">${metaHtml}</div>`;
    metaStatsContainer.style.display = 'block';
}

function displayCounterTeams(monsterIds) {
    // La fonction de rappel pour "Add Counter" est maintenant gérée directement dans searchMonster.
    // On passe une fonction vide ou null pour éviter de recréer un listener.
    const openModalCallback = (teamData) => {
        const defenseMonsters = teamData.monsters.map(m => allMonsters.find(mon => mon.fields.com2us_id === m.monster_id));
        openAddCounterModal(defenseMonsters, teamData.team_id);
    };
    const switchViewCallback = (view) => {
        currentCounterView = view;
        displayCounterTeams(monsterIds); // Rafraîchit l'affichage avec la nouvelle vue
    };
    displayCounterTeamsUI(monsterIds, teamsData, openModalCallback, switchViewCallback, currentCounterView);
}

/**
 * Trouve une équipe par ses monstres, ou la crée si elle n'existe pas.
 * @param {object[]} monsters - Tableau d'objets monstres.
 * @returns {object} L'objet équipe trouvé ou créé.
 */
function findOrCreateTeam(monsters) {
  // La logique s'applique uniquement aux équipes de 3.
  if (!monsters || monsters.length !== 3) return null;

  // Le premier monstre est le "leader", son ID est fixe.
  const leaderId = monsters[0].fields.com2us_id;
  // On trie les IDs des deux autres monstres.
  const followerIds = [monsters[1].fields.com2us_id, monsters[2].fields.com2us_id].sort();

  let team = teamsData.find(t => {
    if (t.monsters.length !== 3 || t.monsters[0].monster_id !== leaderId) return false;
    const teamFollowerIds = [t.monsters[1].monster_id, t.monsters[2].monster_id].sort();
    return teamFollowerIds[0] === followerIds[0] && teamFollowerIds[1] === followerIds[1];
  });

  if (!team) {
    team = {
      team_id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${monsters.map(m => m.fields.name).join(', ')}`,
      category: "User-Generated",
      // On sauvegarde les monstres dans l'ordre de la recherche initiale pour la cohérence de l'affichage du nom.
      monsters: monsters.map(m => ({ monster_id: m.fields.com2us_id, is_owned: false })),
      counter: [],
      notes: ""
    };
    // 1. On ajoute la nouvelle équipe au tableau en mémoire.
    teamsData.push(team);
    // Sauvegarde immédiate sur le serveur si une nouvelle équipe est créée.
    // 2. On sauvegarde le tableau mis à jour sur le serveur.
    saveTeamsDataToServer(teamsData); 
  }

  return team;
}

/**
 * Met à jour les statistiques de victoire/défaite pour un counter spécifique.
 * @param {string} defenseTeamId - L'ID de l'équipe de défense.
 * @param {string} counterTeamId - L'ID de l'équipe counter.
 * @param {'success' | 'failure'} type - Le type de compteur à incrémenter.
 */
function updateCounterStats(defenseTeamId, counterTeamId, type) {
    const defenseTeam = teamsData.find(t => t.team_id === defenseTeamId);
    if (defenseTeam) {
        const counterLink = defenseTeam.counter.find(c => c.team_id === counterTeamId);
        if (counterLink) {
            // La référence defense_team_id est déjà ajoutée à la création.
            counterLink[type]++;
            saveTeamsDataToServer(teamsData); // Sauvegarde après chaque mise à jour
            // Rafraîchit l'affichage des counters pour l'équipe de défense actuelle
            displayCounterTeams(defenseTeam.monsters.map(m => m.monster_id));
        } else {
            console.warn(`Lien counter non trouvé pour defenseTeamId: ${defenseTeamId}, counterTeamId: ${counterTeamId}`);
        }
    }
}

/**
 * Supprime une équipe et toutes les références à celle-ci.
 * @param {string} teamIdToDelete - L'ID de l'équipe à supprimer.
 */
function deleteTeam(teamIdToDelete) {
    // 1. Supprime l'équipe de la liste principale.
    teamsData = teamsData.filter(team => team.team_id !== teamIdToDelete);

    // 2. Supprime toutes les références à cette équipe dans les listes "counter" des autres équipes.
    teamsData.forEach(team => {
        team.counter = team.counter.filter(c => c.team_id !== teamIdToDelete);
    });

    // 3. Sauvegarde les données mises à jour.
    saveTeamsDataToServer(teamsData);

    // 4. Rafraîchit l'affichage.
    // On simule une recherche pour la défense actuellement affichée pour rafraîchir la liste des counters.
    const currentSearchTerms = searchInput.value.split(' ').map(term => strNoAccent(term.trim().toLowerCase())).filter(Boolean);
    if (currentSearchTerms.length === 3) {
        const foundMonsters = currentSearchTerms.map(term => allMonsters.find(m => strNoAccent(m.fields.name.toLowerCase()) === term)).filter(Boolean);
        if (foundMonsters.length === 3) {
            displayCounterTeams(foundMonsters.map(m => m.fields.com2us_id));
        }
    } else {
        // Si la recherche actuelle n'est pas une équipe de 3, on cache simplement la section des counters.
        document.getElementById('counter-teams-section').style.display = 'none';
    }
}