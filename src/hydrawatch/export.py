"""Infrastructure as Code (IaC) exporter for sustainable cloud regions."""

from __future__ import annotations


def generate_kubernetes_affinity_yaml(regions: list[str]) -> str:
    """Generate Kubernetes NodeAffinity policy prioritizing clean cloud regions."""
    regions_yaml = "\n".join(f"                    - {r}" for r in regions)
    return f"""# Kubernetes Deployment with Carbon-Aware Region Scheduling
# Generated dynamically by HydraWatch Infrastructure Intelligence

apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-inference-service
  namespace: default
  labels:
    app: llm-inference
    sustainability: green-routed
spec:
  replicas: 2
  selector:
    matchLabels:
      app: llm-inference
  template:
    metadata:
      labels:
        app: llm-inference
    spec:
      affinity:
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            preference:
              matchExpressions:
              - key: topology.kubernetes.io/region
                operator: In
                values:
{regions_yaml}
      containers:
      - name: llm-engine
        image: vllm/vllm-openai:latest
        resources:
          limits:
            nvidia.com/gpu: "1"
          requests:
            nvidia.com/gpu: "1"
        ports:
        - containerPort: 8000
"""


def generate_terraform_provider_tf(provider: str, region: str, score: float) -> str:
    """Generate Terraform configurations pointing to the primary sustainable region."""
    provider = provider.lower()
    if provider == "aws":
        return f"""# Terraform Sustainable AWS Provider Configuration
# Generated dynamically by HydraWatch Infrastructure Intelligence

terraform {{
  required_version = ">= 1.5.0"
  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

provider "aws" {{
  region = "{region}"
  
  default_tags {{
    tags = {{
      SustainabilityGate = "Passed"
      HydraSustainabilityScore = "{score:.1f}"
      CarbonManaged = "True"
    }}
  }}
}}

resource "aws_instance" "llm_server" {{
  ami           = "ami-0c55b159cbfafe1f0" # Replace with region-specific deep learning AMI
  instance_type = "g5.xlarge" # A100/A10G instance equivalent
  
  tags = {{
    Name = "sustainable-llm-node"
  }}
}}
"""
    elif provider == "gcp":
        return f"""# Terraform Sustainable GCP Provider Configuration
# Generated dynamically by HydraWatch Infrastructure Intelligence

terraform {{
  required_version = ">= 1.5.0"
  required_providers {{
    google = {{
      source  = "hashicorp/google"
      version = "~> 5.0"
    }}
  }}
}}

provider "google" {{
  region  = "{region}"
  project = var.gcp_project_id
}}

resource "google_compute_instance" "llm_server" {{
  name         = "sustainable-llm-node"
  machine_type = "a2-highgpu-1g" # Single A100 node
  zone         = "{region}-a"
  
  boot_disk {{
    initialize_params {{
      image = "deeplearning-platform-release/pytorch-latest-gpu"
    }}
  }}

  network_interface {{
    network = "default"
  }}
  
  labels = {{
    sustainability_gate = "passed"
    hydra_score         = "{int(score)}"
  }}
}}
"""
    else:
        # Fallback multi-cloud config
        return f"""# Terraform Provider Config (Sustainable Region)
# Generated dynamically by HydraWatch Infrastructure Intelligence

provider "{provider}" {{
  region = "{region}"
}}

# Region Score: {score:.1f}/100
"""
