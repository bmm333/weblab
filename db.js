const sqlite3 = require('sqlite3').verbose();
const db=new sqlite3.Database('tasks.db');

db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS task(
        id INTERGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        importante INTERGER DEFAULT 0,
        privato INTERGER DEFAULT 1,
        progetto TEXT,
        scadenza TEXT,
        completato INTERGER DEFAULT 0,
    )`);
});

module.exports=db;