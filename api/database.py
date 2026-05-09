import os
import hashlib
from sqlalchemy import create_engine, Column, Integer, String, LargeBinary, DateTime, func, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import logging

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    host = DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else "local/unknown"
    logging.info(f"Database URL detected. Host suffix: ...@{host}")
else:
    logging.warning("DATABASE_URL NOT FOUND. Using SQLite fallback.")
    if os.environ.get('VERCEL'):
        DATABASE_URL = "sqlite:////tmp/metadata.db"
    else:
        DATABASE_URL = "sqlite:///./metadata.db"

# Fix for Railway PostgreSQL URL (postgres:// -> postgresql://)
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()

class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, nullable=False, index=True)
    file_data = Column(LargeBinary, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_hash = Column(String(64), nullable=True, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def compute_file_hash(file_data: bytes) -> str:
    return hashlib.sha256(file_data).hexdigest()

# Database engine and session
engine = None
SessionLocal = None

def init_db():
    """Initialize database connection and create tables"""
    global engine, SessionLocal
    
    if not DATABASE_URL:
        # Fallback to local sqlite if not set (should be handled above, but double check)
        logging.warning("DATABASE_URL not set, disabled?")
        return False
    
    try:
        # Increase pool size and max overflow for higher concurrency on dashboard
        engine = create_engine(
            DATABASE_URL, 
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=10,
            pool_timeout=30
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Create tables
        Base.metadata.create_all(bind=engine)

        # Migration: ensure file_hash column exists on pre-existing tables
        _ensure_file_hash_column()
        # Backfill any rows missing a hash
        backfill_file_hashes()

        logging.info("Database initialized successfully")
        return True
    except Exception as e:
        logging.error(f"Failed to initialize database: {e}")
        return False

def get_db():
    """Get database session"""
    if SessionLocal is None:
        return None
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise

def save_file_to_db(filename: str, file_data: bytes) -> bool:
    """Save file to database"""
    db = get_db()
    if db is None:
        return False

    try:
        file_hash = compute_file_hash(file_data)
        # Check if file exists
        existing_file = db.query(UploadedFile).filter(UploadedFile.filename == filename).first()

        if existing_file:
            # Update existing file
            existing_file.file_data = file_data
            existing_file.file_size = len(file_data)
            existing_file.file_hash = file_hash
            existing_file.updated_at = datetime.utcnow()
        else:
            # Create new file
            new_file = UploadedFile(
                filename=filename,
                file_data=file_data,
                file_size=len(file_data),
                file_hash=file_hash,
            )
            db.add(new_file)

        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to save file to database: {e}")
        return False
    finally:
        db.close()

def get_file_from_db(filename: str) -> bytes:
    """Get file data from database"""
    db = get_db()
    if db is None:
        return None
    
    try:
        file_record = db.query(UploadedFile).filter(UploadedFile.filename == filename).first()
        if file_record:
            return file_record.file_data
        return None
    except Exception as e:
        logging.error(f"Failed to get file from database: {e}")
        return None
    finally:
        db.close()

def list_files_in_db():
    """List all files in database"""
    db = get_db()
    if db is None:
        return []
    
    try:
        files = db.query(UploadedFile).order_by(UploadedFile.uploaded_at.desc()).all()
        return [{
            "filename": f.filename,
            "size": f.file_size,
            "modified": f.updated_at.timestamp()
        } for f in files]
    except Exception as e:
        logging.error(f"Failed to list files from database: {e}")
        return []
    finally:
        db.close()

def delete_file_from_db(filename: str) -> bool:
    """Delete file from database"""
    db = get_db()
    if db is None:
        return False
    
    try:
        file_record = db.query(UploadedFile).filter(UploadedFile.filename == filename).first()
        if file_record:
            db.delete(file_record)
            db.commit()
            return True
        return False
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to delete file from database: {e}")
        return False
    finally:
        db.close()

def cleanup_old_files_in_db(max_files: int = 5) -> int:
    """Keep only the most recent max_files files"""
    db = get_db()
    if db is None:
        return 0
    
    try:
        # Get all files ordered by upload time (newest first)
        all_files = db.query(UploadedFile).order_by(UploadedFile.uploaded_at.desc()).all()
        
        if len(all_files) <= max_files:
            return 0
        
        # Delete old files
        files_to_delete = all_files[max_files:]
        deleted_count = 0
        
        for file_record in files_to_delete:
            db.delete(file_record)
            deleted_count += 1
        
        db.commit()
        return deleted_count
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to cleanup old files: {e}")
        return 0
    finally:
        db.close()

def get_file_count() -> int:
    """Get total number of files in database"""
    db = get_db()
    if db is None:
        return 0

    try:
        count = db.query(UploadedFile).count()
        return count
    except Exception as e:
        logging.error(f"Failed to get file count: {e}")
        return 0
    finally:
        db.close()


def get_hash_by_filename(filename: str) -> str | None:
    """Look up the SHA256 hash currently stored for a filename."""
    db = get_db()
    if db is None:
        return None
    try:
        row = db.query(UploadedFile).filter(UploadedFile.filename == filename).first()
        return row.file_hash if row and row.file_hash else None
    except Exception as e:
        logging.error(f"Failed to look up hash for {filename}: {e}")
        return None
    finally:
        db.close()


def get_filename_by_hash(file_hash: str) -> str | None:
    """Reverse lookup: which filename currently maps to this hash."""
    db = get_db()
    if db is None:
        return None
    try:
        row = db.query(UploadedFile).filter(UploadedFile.file_hash == file_hash).first()
        return row.filename if row else None
    except Exception as e:
        logging.error(f"Failed to look up filename for hash {file_hash}: {e}")
        return None
    finally:
        db.close()


def _ensure_file_hash_column():
    """Add file_hash column to existing uploaded_files tables that predate this change."""
    if engine is None:
        return
    try:
        inspector = inspect(engine)
        if not inspector.has_table("uploaded_files"):
            return
        cols = [c["name"] for c in inspector.get_columns("uploaded_files")]
        if "file_hash" in cols:
            return
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE uploaded_files ADD COLUMN file_hash VARCHAR(64)"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_uploaded_files_file_hash "
                "ON uploaded_files (file_hash)"
            ))
        logging.info("Migration: added file_hash column to uploaded_files")
    except Exception as e:
        logging.error(f"Failed to ensure file_hash column: {e}")


def backfill_file_hashes() -> int:
    """Compute file_hash for any rows missing it. Returns the number backfilled."""
    if SessionLocal is None:
        return 0
    db = get_db()
    if db is None:
        return 0
    try:
        rows = db.query(UploadedFile).filter(UploadedFile.file_hash.is_(None)).all()
        count = 0
        for row in rows:
            try:
                row.file_hash = compute_file_hash(row.file_data)
                count += 1
            except Exception as e:
                logging.error(f"Failed to hash file id={row.id}: {e}")
        if count:
            db.commit()
            logging.info(f"Backfilled file_hash for {count} row(s)")
        return count
    except Exception as e:
        db.rollback()
        logging.error(f"Failed to backfill file hashes: {e}")
        return 0
    finally:
        db.close()
