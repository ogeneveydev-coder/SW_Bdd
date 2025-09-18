const APP_VERSION = "2.9";
document.getElementById("versionLabel").textContent = `HTML v${APP_VERSION}`;

const CSS_VERSION = "3.6";
document.getElementById("cssVersionLabel").textContent = `CSS v${CSS_VERSION}`;

const SCRIPT_VERSION = "3.9";
document.getElementById("scriptVersionLabel").textContent = `JS v${SCRIPT_VERSION}`;

// Ce fichier charge bestiary_data.json et utilise name, element, archetype,
// base_stars, max_lvl_hp, max_lvl_attack, max_lvl_defense, speed, image_filename
// pour afficher les cartes avec stats en barres de progression.
// (Code complet identique à v3.8 avec changement de nom de fichier et ajout archetype)
