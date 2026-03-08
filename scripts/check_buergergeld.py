import psycopg2
import os

# Use DATABASE_URL from environment or fallback
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://systemfehler:dev_password@localhost:5432/systemfehler')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

query = """
SELECT id, title_de, summary_de, content_de FROM entries
WHERE title_de ILIKE '%Bürgergeld%' OR summary_de ILIKE '%Bürgergeld%' OR content_de ILIKE '%Bürgergeld%';
"""
cur.execute(query)
rows = cur.fetchall()

if not rows:
    print("No evidence found for 'Bürgergeld'.")
else:
    print(f"Found {len(rows)} matching entries:")
    for row in rows:
        print(row)

cur.close()
conn.close()
