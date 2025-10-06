/**
 * main.js 
 * Fichier principal de l'application, orchestrant les modules api.js et ui.js.
 */

import { loadInitialData, saveTeamsDataToServer } from './api.js';
import {
    searchInput, resultContainer, suggestionsContainer, searchBtn, resetBtn, drawerHandle,
    createMonsterCard, clearSuggestions, showResult, displayFileVersions,
    initializeBestiaryViews, showMonsterInModal, createTeamCard,
    openAddCounterModal as openAddCounterModalUI,
    displayCounterTeams as displayCounterTeamsUI,
    closeBestiaryDrawer
} from './ui.js';

// --- GESTION DES VERSIONS ---
const fileVersions = {
  script: '4.1.0', // Version pour l'ajout des compteurs win/loss
  style: '2.40',
  index: '2.16' // Version mise à jour pour le script module
};

// --- VARIABLES GLOBALES DE L'APPLICATION ---
export let allMonsters = [];
export let awakenedMonsters = [];
export let myMonsters = [];
export let ownedMonsterIds = new Set();
export let globalMonsterStats = {};
export let teamsData = [];

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
    setupEventListeners();

  } catch (err) {
    console.error("Erreur lors de l'initialisation de l'application.", err);
    showResult("Impossible de charger les données de l'application.");
  }
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

function setupEventListeners() {
    drawerHandle.addEventListener('click', () => {
        const drawer = document.getElementById('bestiary-section');
        const isOpen = drawer.classList.toggle('is-open');
        drawerHandle.textContent = isOpen ? '‹' : '›';
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

  const cardsHtml = foundMonsters.map(monster => createMonsterCard(monster)).join('');
  showResult(`<div class="results-container">${cardsHtml}</div>`);

  const counterSection = document.getElementById('counter-teams-section');
  const addCounterContainer = document.getElementById('add-counter-container');
  const counterResultContainer = document.getElementById('counter-teams-result');

  if (foundMonsters.length === 3) {
    // On trouve ou crée l'équipe de défense. La fonction s'occupe de sauvegarder si nécessaire.
    const defenseTeam = findOrCreateTeam(foundMonsters);
    addCounterContainer.innerHTML = `<button id="add-counter-btn">Add Counter</button>`;
    document.getElementById('add-counter-btn').addEventListener('click', () => openAddCounterModal(foundMonsters, defenseTeam.team_id));
    
    // On affiche les counters existants pour cette équipe
    displayCounterTeams(foundMonsters.map(m => m.fields.com2us_id));
    counterSection.style.display = 'block';
  } else {
    counterSection.style.display = 'none';
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

function displayCounterTeams(monsterIds) {
    // La fonction de rappel pour "Add Counter" est maintenant gérée directement dans searchMonster.
    // On passe une fonction vide ou null pour éviter de recréer un listener.
    const openModalCallback = (teamData) => openAddCounterModal(teamData.monsters.map(m => allMonsters.find(mon => mon.fields.com2us_id === m.monster_id)), teamData.team_id);

    displayCounterTeamsUI(monsterIds, teamsData, openModalCallback);
}

/**
 * Trouve une équipe par ses monstres, ou la crée si elle n'existe pas.
 * @param {object[]} monsters - Tableau d'objets monstres.
 * @returns {object} L'objet équipe trouvé ou créé.
 */
function findOrCreateTeam(monsters) {
  if (!monsters || monsters.length === 0) return null;
  const monsterIds = monsters.map(m => m.fields.com2us_id).sort();

  let team = teamsData.find(t => {
    const teamMonsterIds = t.monsters.map(m => m.monster_id).sort();
    return teamMonsterIds.length === monsterIds.length && teamMonsterIds.every((id, i) => id === monsterIds[i]);
  });

  if (!team) {
    team = {
      team_id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: `${monsters.map(m => m.fields.name).join(', ')}`,
      category: "User-Generated",
      monsters: monsterIds.map(id => ({ monster_id: id, is_owned: false })),
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