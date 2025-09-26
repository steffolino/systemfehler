import sqlite3

class SQLitePipeline:
    def open_spider(self, spider):
        import os
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../data/systemfehler.db'))
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
    def close_spider(self, spider):
        self.conn.commit()
        self.conn.close()
    def process_item(self, item, spider):
        self.cursor.execute('''
            INSERT OR REPLACE INTO staging_entry (id, url, source_domain, fetched_at, lang, title, summary, content, topic, raw_json, category, source_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            item.get('id'),
            item.get('url'),
            item.get('source_domain'),
            item.get('fetched_at'),
            item.get('lang'),
            item.get('title'),
            item.get('summary'),
            item.get('content'),
            item.get('topic'),
            item.get('raw_json'),
            item.get('category'),
            item.get('source_url'),
        ))
        return item
