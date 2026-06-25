import sqlite3
conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()
c.execute("SELECT title, publish_date FROM book")
print('Books:', c.fetchall())
c.execute("SELECT code, generated_at, status FROM magazine_access_code ORDER BY generated_at DESC LIMIT 10")
print('Codes:', c.fetchall())
conn.close()
