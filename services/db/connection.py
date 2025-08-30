import os
import psycopg2  # or another driver

def get_db_connection():
    return psycopg2.connect(os.environ["DATABASE_URL"])
