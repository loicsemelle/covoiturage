const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'data', 'covoit.sqlite'));
db.serialize(() => {
  db.run("DROP TABLE IF EXISTS schedule", (err) => {
    if (err) console.error(err);
    else console.log("Table dropped");
  });
});
db.close();
