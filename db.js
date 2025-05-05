const sqlite3 = require('sqlite3').verbose();
const db=new sqlite3.Database('tasks.db');

db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        important BOOLEAN DEFAULT 0,
        private BOOLEAN DEFAULT 1,
        project TEXT,
        deadline TEXT,
        completed BOOLEAN DEFAULT 0
      );`);
});

module.exports=db;