"""Static lookup tables for HydraWatch estimation."""

# Region-specific WUE (L/kWh) — provider sustainability reports 2022-2023
WUE: dict[str, float] = {
    "us-east-1": 2.1, "us-east-2": 1.4, "us-west-1": 1.9, "us-west-2": 1.6,
    "ap-south-1": 2.4, "ap-south-2": 2.2, "eu-north-1": 0.8, "eu-west-1": 1.2,
    "us-central1": 1.4, "us-west1": 1.7, "asia-south1": 2.4, "asia-south2": 2.2,
    "europe-north1": 0.7, "eastus": 2.1, "westus3": 2.3, "centralindia": 2.4,
    "swedencentral": 0.8, "westus2": 1.3, "norwayeast": 0.9, "europe-west4": 1.1,
    "DEFAULT": 1.8,
}

# Power Usage Effectiveness — facility overhead multiplier
PUE: dict[str, float] = {
    "eu-north-1": 1.15, "europe-north1": 1.12, "swedencentral": 1.15,
    "norwayeast": 1.12, "us-west-2": 1.18, "us-west1": 1.18, "westus2": 1.18,
    "eu-west-1": 1.20, "northeurope": 1.20, "us-central1": 1.25, "centralus": 1.25,
    "DEFAULT": 1.22,
}

GPU_COST_PER_HOUR: dict[str, dict[str, float]] = {
    "A100": {"AWS": 3.97, "GCP": 3.67, "Azure": 3.40, "OCI": 3.50, "IBM": 3.80, "Alibaba": 3.20, "DigitalOcean": 2.50},
    "H100": {"AWS": 9.80, "GCP": 10.20, "Azure": 9.50, "OCI": 9.20, "IBM": 9.50, "Alibaba": 8.80, "DigitalOcean": 8.00},
    "V100": {"AWS": 3.06, "GCP": 2.48, "Azure": 2.95, "OCI": 2.80, "IBM": 3.00, "Alibaba": 2.60, "DigitalOcean": 2.20},
    "T4": {"AWS": 0.53, "GCP": 0.35, "Azure": 0.50, "OCI": 0.45, "IBM": 0.55, "Alibaba": 0.40, "DigitalOcean": 0.35},
}

LATENCY_MS: dict[tuple[str, str], int] = {
    ("India", "ap-south-1"): 15, ("India", "ap-south-2"): 20,
    ("India", "ap-southeast-1"): 60, ("India", "us-east-1"): 180,
    ("India", "eu-west-1"): 120, ("India", "eu-north-1"): 140,
    ("India", "asia-south1"): 15, ("India", "asia-south2"): 20,
    ("India", "centralindia"): 15, ("India", "westindia"): 10,
    ("India", "southindia"): 25, ("India", "swedencentral"): 145,
    ("India", "europe-north1"): 150, ("India", "norwayeast"): 140,
    ("United States", "us-east-1"): 10, ("United States", "us-east-2"): 12,
    ("United States", "us-west-1"): 20, ("United States", "us-west-2"): 18,
    ("United States", "eu-west-1"): 90, ("United States", "ap-south-1"): 180,
    ("Europe", "eu-west-1"): 15, ("Europe", "eu-central-1"): 12,
    ("Europe", "eu-north-1"): 25, ("Europe", "us-east-1"): 90,
    ("Europe", "swedencentral"): 20, ("Europe", "europe-north1"): 30,
}

GPU_SPECS: dict[str, dict[str, float]] = {
    "A100": {"tdp_watts": 400},
    "H100": {"tdp_watts": 700},
    "V100": {"tdp_watts": 300},
    "T4": {"tdp_watts": 70},
}

TOKENS_PER_SEC_PER_GPU: dict[str, float] = {
    "A100": 3000, "H100": 6000, "V100": 1500, "T4": 800,
}

MODEL_SPECS: dict[str, dict[str, float]] = {
    "GPT-4": {"params_B": 1800, "compute_multiplier": 60.0},
    "LLaMA-3-70B": {"params_B": 70, "compute_multiplier": 9.0},
    "LLaMA-3-8B": {"params_B": 8, "compute_multiplier": 1.0},
    "Mistral-7B": {"params_B": 7, "compute_multiplier": 0.9},
    "Gemma-7B": {"params_B": 7, "compute_multiplier": 0.9},
    "Claude-Haiku": {"params_B": 20, "compute_multiplier": 2.5},
    "Claude-Sonnet": {"params_B": 70, "compute_multiplier": 9.0},
    "Custom/Unknown": {"params_B": 8, "compute_multiplier": 1.0},
}

# Estimation defaults
DEFAULT_UTILIZATION = 0.65
DEFAULT_IDLE_FRACTION = 0.15
ESTIMATE_TIER = "L2"
ESTIMATE_DISCLAIMER = (
    "Comparative decision support — not audited carbon accounting. "
    "Absolute values are modeled estimates (±25-40%); use for region trade-off analysis."
)

SENSITIVITY = {
    "wue": 0.25,
    "carbon": 0.20,
    "utilization": 0.20,
    "pue": 0.10,
}
