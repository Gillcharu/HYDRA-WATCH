"""SQLite database manager for persistent state and caching."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# Configurable database path (defaulting to /tmp/hydrawatch.db for serverless/writable access)
DB_PATH = Path(os.environ.get("HYDRAWATCH_DB_PATH", "/tmp/hydrawatch.db"))


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize SQLite tables for footprint history, carbon cache, and api keys."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS footprint_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                region TEXT NOT NULL,
                water REAL NOT NULL,
                carbon REAL NOT NULL,
                qps REAL NOT NULL,
                timestamp TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS carbon_live_cache (
                zone TEXT PRIMARY KEY,
                carbon_kg_kwh REAL NOT NULL,
                source TEXT NOT NULL,
                fetched_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                key TEXT PRIMARY KEY,
                tenant_name TEXT NOT NULL,
                department TEXT NOT NULL
            )
        """)
        seed_spec = os.environ.get("HYDRAWATCH_API_KEYS", "").strip()
        if seed_spec:
            for entry in seed_spec.split(","):
                parts = [p.strip() for p in entry.split(":", 2)]
                if len(parts) != 3 or not all(parts):
                    continue
                key, tenant_name, department = parts
                conn.execute(
                    """
                    INSERT OR IGNORE INTO api_keys (key, tenant_name, department)
                    VALUES (?, ?, ?)
                    """,
                    (key, tenant_name, department),
                )
        conn.commit()


# Initialize database upon importing the module
init_db()


def record_footprint_db(region_code: str, water: float, carbon: float, qps: float) -> None:
    """Append a footprint record and keep history capped to the last 200 items."""
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO footprint_history (region, water, carbon, qps) VALUES (?, ?, ?, ?)",
            (region_code, water, carbon, qps),
        )
        # Cap footprint history at 200 elements
        conn.execute("""
            DELETE FROM footprint_history 
            WHERE id NOT IN (
                SELECT id FROM footprint_history 
                ORDER BY id DESC LIMIT 200
            )
        """)
        conn.commit()


def load_footprint_history_db() -> list[dict]:
    """Retrieve historical footprint runs."""
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT region, water, carbon, qps, timestamp FROM footprint_history ORDER BY id ASC"
        )
        return [
            {
                "region": row["region"],
                "water": row["water"],
                "carbon": row["carbon"],
                "qps": row["qps"],
                "timestamp": row["timestamp"],
            }
            for row in cursor.fetchall()
        ]


def get_cached_carbon(zone: str) -> dict | None:
    """Retrieve dynamic carbon intensity cache if it exists and is less than 1 hour old."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT carbon_kg_kwh, source, fetched_at FROM carbon_live_cache WHERE zone = ?",
            (zone,),
        ).fetchone()

        if not row:
            return None

        try:
            fetched = datetime.fromisoformat(row["fetched_at"].replace("Z", "+00:00"))
            age_h = (datetime.now(timezone.utc) - fetched).total_seconds() / 3600.0
            if age_h < 1.0:
                return {
                    "carbon_kg_kwh": row["carbon_kg_kwh"],
                    "source": row["source"],
                    "fetched_at": row["fetched_at"],
                }
        except Exception:
            pass
        return None


def set_cached_carbon(zone: str, carbon: float, source: str) -> None:
    """Insert or update live carbon intensity cache."""
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO carbon_live_cache (zone, carbon_kg_kwh, source, fetched_at)
            VALUES (?, ?, ?, ?)
            """,
            (zone, carbon, source, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()


def verify_api_key_db(key: str) -> dict | None:
    """Look up tenant and department info for a given api key."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT tenant_name, department FROM api_keys WHERE key = ?",
            (key,),
        ).fetchone()
        if row:
            return {"tenant_name": row["tenant_name"], "department": row["department"]}
        return None
