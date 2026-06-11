"""SQLAlchemy Database configuration and models for production persistence."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Column, DateTime, Float, JSON, String, Text, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Setup engine with fallback to local SQLite database
db_url = os.environ.get("DATABASE_URL")
if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
else:
    # Ensure data directory exists for SQLite
    ROOT = Path(__file__).resolve().parents[2]
    data_dir = ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    db_url = f"sqlite:///{data_dir}/hydrawatch.db"

# Create engine
# connect_args={"check_same_thread": False} is required for SQLite to share connection threads
engine_args = {}
if db_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(db_url, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class GeocodeCache(Base):
    __tablename__ = "geocode_cache"

    query = Column(String(255), primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    display_name = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SavedEstimate(Base):
    __tablename__ = "saved_estimates"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    # Configuration JSON holding tool, task type, daily prompts, location coordinates, comparison modes, etc.
    config_data = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def init_db():
    """Create all tables if they do not exist."""
    Base.metadata.create_all(bind=engine)

# Initialize tables upon module import
init_db()


def get_db():
    """Dependency generator for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
