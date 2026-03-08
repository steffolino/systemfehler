from sqlalchemy import create_engine, Column, String, Date, DateTime, Boolean, JSON, Enum, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, sessionmaker
import os

Base = declarative_base()

class Entry(Base):
    __tablename__ = 'entries'
    id = Column(UUID(as_uuid=True), primary_key=True)
    domain = Column(Enum('benefits', 'aid', 'tools', 'organizations', 'contacts', name='domain_type'))
    title_de = Column(String)
    title_en = Column(String)
    title_easy_de = Column(String)
    summary_de = Column(String)
    summary_en = Column(String)
    summary_easy_de = Column(String)
    content_de = Column(String)
    content_en = Column(String)
    content_easy_de = Column(String)
    url = Column(String)
    topics = Column(ARRAY(String))
    tags = Column(ARRAY(String))
    target_groups = Column(ARRAY(String))
    valid_from = Column(Date)
    valid_until = Column(Date)
    deadline = Column(Date)
    status = Column(Enum('active', 'discontinued', 'archived', 'under_revision', name='entry_status'))
    first_seen = Column(DateTime)
    last_seen = Column(DateTime)
    source_unavailable = Column(Boolean)
    provenance = Column(JSON)
    translations = Column(JSON)
    quality_scores = Column(JSON)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

# Add domain extension models as needed (e.g. Benefits, Aid, etc.)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://systemfehler:dev_password@localhost:5432/systemfehler')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
