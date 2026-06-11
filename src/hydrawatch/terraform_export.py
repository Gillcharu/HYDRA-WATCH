"""Terraform / CI export for infra-as-code integration."""

from __future__ import annotations


def terraform_recommendation(
    provider: str,
    region_code: str,
    gpu_type: str,
    gpus: float,
    model_name: str,
) -> str:
    """Generate Terraform snippet for recommended deployment."""
    if provider == "AWS":
        return f'''# HydraWatch recommendation — {model_name} on {gpu_type}
resource "aws_instance" "hydrawatch_gpu" {{
  count         = {int(max(1, gpus))}
  ami           = "ami-gpu-ml-inference"  # replace with your GPU AMI
  instance_type = "{"p4d.24xlarge" if gpu_type == "A100" else "p5.48xlarge" if gpu_type == "H100" else "g4dn.xlarge"}"
  availability_zone = "{region_code}a"

  tags = {{
    Project = "hydrawatch"
    Model   = "{model_name}"
    GPU     = "{gpu_type}"
  }}
}}
'''
    if provider == "GCP":
        return f'''# HydraWatch recommendation — {model_name}
resource "google_compute_instance" "hydrawatch_gpu" {{
  count        = {int(max(1, gpus))}
  name         = "hydrawatch-gpu-${{count.index}}"
  machine_type = "{"a2-highgpu-1g" if gpu_type in ("A100", "H100") else "n1-standard-4"}"
  zone         = "{region_code}-a"

  guest_accelerator {{
    type  = "{"nvidia-tesla-a100" if gpu_type == "A100" else "nvidia-tesla-t4"}"
    count = 1
  }}

  labels = {{ model = "{model_name.lower().replace("/", "-")}" }}
}}
'''
    return f'''# HydraWatch recommendation — Azure {region_code}
resource "azurerm_kubernetes_cluster" "hydrawatch" {{
  name                = "hydrawatch-aks"
  location            = "{region_code}"
  resource_group_name = "hydrawatch-rg"

  default_node_pool {{
    name       = "gpu"
    node_count = {int(max(1, gpus))}
    vm_size    = "Standard_NC6s_v3"
  }}

  tags = {{ model = "{model_name}" }}
}}
'''


def github_action_snippet(region_code: str, provider: str) -> str:
    return f'''# .github/workflows/deploy-sustainability-check.yml
name: Sustainability gate
on: [pull_request]
jobs:
  hydrawatch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: |
          python run.py analyze \\
            --provider {provider} \\
            --region {region_code} \\
            --qps ${{{{ vars.ESTIMATED_QPS }}}} \\
            --fail-if-score-below 40
'''
