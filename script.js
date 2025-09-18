/* script_reset.js - ajout bouton Reset */

// ... le code original de ton script est conservé ici ...
// Je ne le réécris pas entièrement pour ne pas altérer, je ne fais qu'ajouter ce qui suit à la fin :

function initReset() {
  const resetBtn = document.getElementById("resetBtn");
  if (!resetBtn) return;
  resetBtn.addEventListener("click", () => {
    if (typeof selectedMonsters !== "undefined") selectedMonsters.clear();

    const multiInput = document.getElementById("multiInput");
    if (multiInput) multiInput.value = "";

    const resultsMulti = document.querySelector(".results-multi");
    if (resultsMulti) resultsMulti.innerHTML = "";

    const suggestionsMulti = document.getElementById("multiSuggestions");
    if (suggestionsMulti) suggestionsMulti.innerHTML = "";

    // Réinitialiser aussi les 3 recherches séparées
    for (let i of [1,2,3]) {
      const input = document.getElementById(`search${i}`);
      const sugg = document.getElementById(`suggestions${i}`);
      const res = document.querySelector(`.results-${i}`);
      if (input) input.value = "";
      if (sugg) sugg.innerHTML = "";
      if (res) res.innerHTML = "";
    }
  });
}

// Appel après initialisation existante
loadMonsters().then(() => {
  initMultiSearch();
  initSearch("search1", "btn1", ".results-1", "suggestions1");
  initSearch("search2", "btn2", ".results-2", "suggestions2");
  initSearch("search3", "btn3", ".results-3", "suggestions3");
  initReset(); // ajout
});
