
from sqlalchemy import create_engine, text
import os
import json
from jsonschema import validate, ValidationError

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://systemfehler:dev_password@localhost:5432/systemfehler")
engine = create_engine(DATABASE_URL)

def load_schema():
    schema_path = os.path.join(os.path.dirname(__file__), '../data/_schemas/core.schema.json')
    with open(schema_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_entry_by_id(entry_id):
    schema = load_schema()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM entries WHERE id = :id"), {"id": entry_id})
        entry = result.fetchone()
        if entry:
            entry_dict = dict(entry._mapping)
            # Convert UUID and datetime fields to string for JSON/schema compliance
            for k, v in entry_dict.items():
                if hasattr(v, 'isoformat'):
                    entry_dict[k] = v.isoformat()
                elif type(v).__name__ == 'UUID':
                    entry_dict[k] = str(v)
            try:
                validate(instance=entry_dict, schema=schema)
                print("Entry is VALID against schema.")
            except ValidationError as e:
                print("Entry is INVALID against schema:")
                print(e)
            print(entry_dict)
        else:
            print("Entry not found.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python get_entry.py <entry_id>")
    else:
        get_entry_by_id(sys.argv[1])