import sqlite3

with open('scripts/schema.sql', encoding='utf-8') as f:
    schema = f.read()

conn = sqlite3.connect('data/systemfehler.db')
conn.executescript(schema)
conn.commit()
conn.close()
print('DB schema created.')
