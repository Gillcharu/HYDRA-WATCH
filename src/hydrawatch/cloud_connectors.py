"""Cloud account connectors — read-only telemetry when credentials configured."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class ConnectorStatus:
    provider: str
    configured: bool
    message: str
    tier_if_connected: str = "V3"


@dataclass
class CloudMetrics:
    qps: float
    invocations: float
    period_hours: float
    source: str
    tier: str = "V3"


def aws_status() -> ConnectorStatus:
    if os.environ.get("HYDRAWATCH_AWS_ROLE_ARN") or os.environ.get("AWS_ACCESS_KEY_ID"):
        return ConnectorStatus("AWS", True, "AWS credentials detected — CloudWatch available", "V3")
    return ConnectorStatus("AWS", False, "Set AWS credentials or HYDRAWATCH_AWS_ROLE_ARN", "V3")


def gcp_status() -> ConnectorStatus:
    if os.environ.get("HYDRAWATCH_GCP_PROJECT") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return ConnectorStatus("GCP", True, "GCP credentials detected", "V3")
    return ConnectorStatus("GCP", False, "Set HYDRAWATCH_GCP_PROJECT + GOOGLE_APPLICATION_CREDENTIALS", "V3")


def azure_status() -> ConnectorStatus:
    if os.environ.get("HYDRAWATCH_AZURE_SUBSCRIPTION_ID") or os.environ.get("AZURE_CLIENT_ID"):
        return ConnectorStatus("Azure", True, "Azure credentials detected", "V3")
    return ConnectorStatus("Azure", False, "Set HYDRAWATCH_AZURE_SUBSCRIPTION_ID", "V3")


def all_connector_status() -> list[ConnectorStatus]:
    return [aws_status(), gcp_status(), azure_status()]


def fetch_aws_cloudwatch_qps(
    namespace: str = "AWS/Lambda",
    metric_name: str = "Invocations",
    dimension_name: str = "FunctionName",
    dimension_value: str | None = None,
    hours: int = 24,
) -> CloudMetrics | None:
    """Fetch average QPS from CloudWatch when boto3 + credentials available."""
    try:
        import boto3
    except ImportError:
        return None
    if not (os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("HYDRAWATCH_AWS_ROLE_ARN")):
        return None
    fn = dimension_value or os.environ.get("HYDRAWATCH_AWS_FUNCTION_NAME")
    if not fn:
        return None
    try:
        cw = boto3.client("cloudwatch", region_name=os.environ.get("AWS_DEFAULT_REGION", "ap-south-1"))
        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=hours)
        resp = cw.get_metric_statistics(
            Namespace=namespace,
            MetricName=metric_name,
            Dimensions=[{"Name": dimension_name, "Value": fn}],
            StartTime=start,
            EndTime=end,
            Period=3600,
            Statistics=["Sum"],
        )
        pts = resp.get("Datapoints", [])
        if not pts:
            return None
        total = sum(float(p["Sum"]) for p in pts)
        period_h = hours
        qps = total / max(period_h * 3600, 1)
        return CloudMetrics(qps=max(1.0, round(qps, 2)), invocations=total, period_hours=period_h, source="aws_cloudwatch")
    except Exception:
        return None
