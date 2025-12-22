from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, text

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"Connecting to: {DATABASE_URL.split('@')[-1] if DATABASE_URL else 'NONE'}")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT filename, uploaded_at FROM uploaded_files"))
        files = result.fetchall()
        print(f"Total files in DB: {len(files)}")
        for f in files:
            print(f"- {f[0]} (Uploaded: {f[1]})")
except Exception as e:
    print(f"Error: {e}")
