"""Persistent audit trail with hash chain integrity."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from hydrawatch.provenance import DATASET_VERSION, METHODOLOGY_VERSION

DATA = Path(__file__).resolve().parents[2] / "data"
AUDIT_DIR = DATA / "audit_history"
CHAIN_FILE = AUDIT_DIR / "chain.json"


def _hash_payload(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _load_chain() -> list[dict]:
    if CHAIN_FILE.exists():
        return json.loads(CHAIN_FILE.read_text())
    return []


def _append_chain(audit_id: str, content_hash: str, prev_hash: str) -> None:
    chain = _load_chain()
    chain.append({
        "audit_id": audit_id,
        "hash": content_hash,
        "prev_hash": prev_hash,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    CHAIN_FILE.write_text(json.dumps(chain, indent=2))


def save_audit(audit: dict, team: str = "default") -> str:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    audit_id = str(uuid.uuid4())[:8]
    chain = _load_chain()
    prev_hash = chain[-1]["hash"] if chain else "0" * 64

    body = {
        **audit,
        "audit_id": audit_id,
        "methodology_version": METHODOLOGY_VERSION,
        "dataset_version": DATASET_VERSION,
        "team": team,
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    content_hash = _hash_payload(body)
    body["integrity"] = {"content_hash": content_hash, "prev_hash": prev_hash}

    path = AUDIT_DIR / f"{audit_id}.json"
    path.write_text(json.dumps(body, indent=2, default=str))
    _append_chain(audit_id, content_hash, prev_hash)
    return audit_id


def verify_audit(audit_id: str) -> dict:
    p = AUDIT_DIR / f"{audit_id}.json"
    if not p.exists():
        return {"valid": False, "reason": "not found"}
    body = json.loads(p.read_text())
    stored = body.get("integrity", {}).get("content_hash", "")
    check = body.copy()
    check.pop("integrity", None)
    computed = _hash_payload(check)
    return {
        "valid": stored == computed,
        "audit_id": audit_id,
        "content_hash": computed,
        "methodology_version": body.get("methodology_version"),
    }


def list_audits(limit: int = 20) -> list[dict]:
    if not AUDIT_DIR.exists():
        return []
    files = sorted(AUDIT_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True)
    out = []
    for f in files:
        if f.name == "chain.json":
            continue
        out.append(json.loads(f.read_text()))
        if len(out) >= limit:
            break
    return out


def get_audit(audit_id: str) -> dict | None:
    p = AUDIT_DIR / f"{audit_id}.json"
    return json.loads(p.read_text()) if p.exists() else None
