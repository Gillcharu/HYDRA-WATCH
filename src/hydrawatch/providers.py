"""Supported cloud providers — single source of truth."""

from __future__ import annotations

ALL_PROVIDERS: list[str] = [
    "AWS",
    "GCP",
    "Azure",
    "OCI",
    "IBM",
    "Alibaba",
    "DigitalOcean",
]

PROVIDER_LABELS: dict[str, str] = {
    "AWS": "Amazon Web Services",
    "GCP": "Google Cloud",
    "Azure": "Microsoft Azure",
    "OCI": "Oracle Cloud",
    "IBM": "IBM Cloud",
    "Alibaba": "Alibaba Cloud",
    "DigitalOcean": "DigitalOcean",
}

# Default GPU $/hr when provider-specific price unknown
DEFAULT_GPU_COST: dict[str, float] = {
    "AWS": 3.97, "GCP": 3.67, "Azure": 3.40,
    "OCI": 3.50, "IBM": 3.80, "Alibaba": 3.20, "DigitalOcean": 2.50,
}
