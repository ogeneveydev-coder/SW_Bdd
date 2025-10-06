const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const TEAMS_FILE_PATH = path.join(__dirname, 'teams.json'); // On revient au fichier local pour le développement

// Middleware pour parser le JSON des requêtes entrantes
app.use(express.json());

// Middleware pour servir les fichiers statiques (html, css, js, images, etc.)
// Il va chercher les fichiers dans le répertoire où se trouve server.js
app.use(express.static(__dirname));


// --- API ROUTES ---

// GET /api/teams - Lit et renvoie le contenu de teams.json
app.get('/api/teams', (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/teams - Lecture du fichier.`);
    fs.readFile(TEAMS_FILE_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error("Erreur lors de la lecture de teams.json:", err);
            // Si le fichier n'existe pas, on renvoie un tableau vide.
            if (err.code === 'ENOENT') {
                return res.status(200).json([]);
            }
            return res.status(500).json({ message: "Erreur interne du serveur lors de la lecture du fichier." });
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    });
});

// POST /api/teams - Reçoit des données et les écrit dans teams.json
app.post('/api/teams', (req, res) => {
    const teamsData = req.body;
    console.log(`[${new Date().toISOString()}] POST /api/teams - Requête de sauvegarde reçue.`);

    // On écrit les nouvelles données dans le fichier, en écrasant l'ancien contenu.
    fs.writeFile(TEAMS_FILE_PATH, JSON.stringify(teamsData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error("Erreur lors de l'écriture dans teams.json:", err);
            return res.status(500).json({ message: "Erreur interne du serveur lors de la sauvegarde." });
        }
        console.log(`[${new Date().toISOString()}] Succès : teams.json a été sauvegardé.`);
        res.status(200).json({ message: "Données sauvegardées avec succès." });
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});