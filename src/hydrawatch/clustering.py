"""Cluster cloud regions by sustainability characteristics."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

from hydrawatch.wue_data import get_wue

CLUSTER_LABELS = {
    0: "Low carbon, low water risk",
    1: "Low carbon, elevated water stress",
    2: "High carbon, high water risk",
    3: "Moderate footprint",
}


def build_feature_matrix(regions_df: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray, list[str]]:
    rows = []
    codes = []
    for _, r in regions_df.iterrows():
        if pd.isna(r.get("water_stress_score")):
            continue
        rc = r["region_code"]
        rows.append({
            "water_stress": float(r["water_stress_score"]),
            "drought_risk": float(r.get("drought_risk", 2.0)),
            "wue": get_wue(rc),
            "carbon": float(r["carbon_kg_per_kwh"]),
        })
        codes.append(rc)

    feat_df = pd.DataFrame(rows)
    scaler = StandardScaler()
    X = scaler.fit_transform(feat_df)
    return feat_df, X, codes


def cluster_regions(
    regions_df: pd.DataFrame,
    n_clusters: int = 4,
    random_state: int = 42,
) -> dict:
    feat_df, X, codes = build_feature_matrix(regions_df)
    if len(codes) < n_clusters:
        n_clusters = max(2, len(codes))

    model = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
    labels = model.fit_predict(X)
    silhouette = float(silhouette_score(X, labels)) if len(set(labels)) > 1 and len(X) > n_clusters else 0.0

    # Order clusters by mean carbon + water stress for readable labels
    cluster_stats = []
    for c in range(n_clusters):
        mask = labels == c
        cluster_stats.append({
            "cluster_id": c,
            "mean_carbon": feat_df.loc[mask, "carbon"].mean(),
            "mean_water_stress": feat_df.loc[mask, "water_stress"].mean(),
            "count": int(mask.sum()),
        })
    cluster_stats.sort(key=lambda x: x["mean_carbon"] + x["mean_water_stress"])

    label_map = {}
    for rank, stat in enumerate(cluster_stats):
        if stat["mean_carbon"] < 0.15 and stat["mean_water_stress"] < 2.5:
            label_map[stat["cluster_id"]] = "Low carbon, low water risk"
        elif stat["mean_carbon"] < 0.20:
            label_map[stat["cluster_id"]] = "Low carbon, elevated water stress"
        elif stat["mean_carbon"] > 0.45 or stat["mean_water_stress"] > 3.5:
            label_map[stat["cluster_id"]] = "High carbon, high water risk"
        else:
            label_map[stat["cluster_id"]] = "Moderate footprint"

    assignments = {}
    for rc, label, feats in zip(codes, labels, feat_df.to_dict("records")):
        row = regions_df[regions_df["region_code"] == rc].iloc[0]
        assignments[rc] = {
            "cluster_id": int(label),
            "cluster_label": label_map.get(int(label), "Moderate footprint"),
            "provider": row["provider"],
            "region_name": row["region_name"],
            "country": row["country"],
            **feats,
        }

    summary = {}
    for cid, lbl in label_map.items():
        members = [k for k, v in assignments.items() if v["cluster_id"] == cid]
        summary[str(cid)] = {"label": lbl, "regions": members, "count": len(members)}

    # Quadrant insights for ML narrative
    insights = []
    for cid, lbl in label_map.items():
        members = [assignments[k] for k in assignments if assignments[k]["cluster_id"] == cid]
        if members:
            insights.append({
                "cluster_id": cid,
                "label": lbl,
                "avg_carbon": round(sum(m["carbon"] for m in members) / len(members), 3),
                "avg_water_stress": round(sum(m["water_stress"] for m in members) / len(members), 2),
                "top_regions": [m["region_name"] for m in members[:3]],
            })

    return {
        "assignments": assignments,
        "summary": summary,
        "insights": insights,
        "quality": {"silhouette": round(silhouette, 3), "n_clusters": n_clusters, "n_regions": len(codes)},
    }


def save_clusters(result: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, indent=2))
