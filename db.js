const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'covoit.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de l\'ouverture de la base de données', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS schedule (
      date TEXT PRIMARY KEY,
      morning_driver TEXT,
      morning_passengers TEXT,
      morning_time TEXT,
      evening_driver TEXT,
      evening_passengers TEXT,
      evening_time TEXT
    )`);
  }
});

module.exports = db;
