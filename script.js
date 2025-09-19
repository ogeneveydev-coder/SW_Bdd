// script.js - version 5.0

console.log("JS v5.0 chargé");

function updateVersions() {
  document.getElementById("scriptVersionLabel").textContent = "JS v5.0";
  document.getElementById("cssVersionLabel").textContent = "CSS v5.0";
}

function initReset() {
  const resetBtn = document.getElementById("resetBtn");
  if (!resetBtn) return;
  resetBtn.addEventListener("click", () => {
    const multiInput = document.getElementById("multiInput");
    if (multiInput) multiInput.value = "";
    const resultsMulti = document.querySelector(".results-multi");
    if (resultsMulti) resultsMulti.innerHTML = "";
    const suggestionsMulti = document.getElementById("multiSuggestions");
    if (suggestionsMulti) suggestionsMulti.innerHTML = "";
  });
}

// Simulation init
document.addEventListener("DOMContentLoaded", () => {
  updateVersions();
  initReset();
});
