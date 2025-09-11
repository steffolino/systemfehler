// Check row counts for all main tables
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('.generated/local.sqlite');
const tables = ['Contact', 'Benefit', 'AidOffer', 'Tool'];

let pending = tables.length;
tables.forEach(table => {
  db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
    if (err) {
      console.log(`${table}: ERROR (${err.message})`);
    } else {
      console.log(`${table}: ${row.count}`);
    }
    if (--pending === 0) db.close();
  });
});
