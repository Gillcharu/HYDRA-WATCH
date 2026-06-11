"""Command-line interface for HydraWatch."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from hydrawatch.analysis import full_analysis, load_regions, print_analysis
from hydrawatch.clustering import cluster_regions, save_clusters
from hydrawatch.providers import ALL_PROVIDERS

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="HydraWatch — estimate AI workload environmental impact and recommend greener regions"
    )
    sub = parser.add_subparsers(dest="command")

    analyze = sub.add_parser("analyze", help="Run full workload analysis")
    analyze.add_argument("--provider", default="AWS", choices=ALL_PROVIDERS)
    analyze.add_argument("--region", default="ap-south-1")
    analyze.add_argument("--qps", type=float, default=150)
    analyze.add_argument("--tokens", type=float, default=1000)
    analyze.add_argument("--gpu", default="A100", choices=["A100", "H100", "V100", "T4"])
    analyze.add_argument("--model", default="LLaMA-3-70B")
    analyze.add_argument("--user-location", default="India")
    analyze.add_argument("--max-latency", type=int, default=150)
    analyze.add_argument("--cost-tolerance", type=float, default=10.0)

    gate = sub.add_parser("gate", help="CI deploy gate (exit 1 on fail)")
    gate.add_argument("--provider", default="AWS", choices=ALL_PROVIDERS)
    gate.add_argument("--region", default="ap-south-1")
    gate.add_argument("--min-score", type=float, default=40.0)
    gate.add_argument("--min-tier", default="V0", choices=["V0", "V1", "V2", "V3", "V4"])
    gate.add_argument("--qps", type=float, default=100)
    gate.add_argument("--tokens", type=int, default=1000)
    gate.add_argument("--gpu", default="A100")
    gate.add_argument("--model", default="LLaMA-3-70B")

    sub.add_parser("validate-all", help="Validate all regions against IEA carbon bands")
    sub.add_parser("case-study", help="Run documented Mumbai vs Stockholm case study")
    sub.add_parser("cluster", help="Run region sustainability clustering")
    sub.add_parser("enrich", help="Enrich region dataset (fill gaps)")

    args = parser.parse_args(argv)

    if args.command == "enrich":
        import subprocess
        script = Path(__file__).resolve().parents[2] / "scripts" / "enrich_regions.py"
        subprocess.run([sys.executable, str(script)], check=True)
        return 0

    if args.command == "cluster":
        df = load_regions()
        result = cluster_regions(df)
        out = DATA_DIR / "region_clusters.json"
        save_clusters(result, out)
        print(f"Wrote clusters to {out} (silhouette={result['quality']['silhouette']})")
        for cid, info in result["summary"].items():
            print(f"\n  Cluster {cid}: {info['label']} ({info['count']} regions)")
            print(f"    {', '.join(info['regions'][:6])}{'...' if info['count'] > 6 else ''}")
        return 0

    if args.command == "validate-all":
        from hydrawatch.auto_validation import validate_all_regions, validation_summary_line
        summary = validate_all_regions(load_regions())
        print(validation_summary_line(summary))
        failed = [r for r in summary["results"] if not r["pass"]]
        if failed:
            print(f"\n{len(failed)} outliers:")
            for r in failed[:10]:
                print(f"  {r['provider']} {r['region_code']}: {r['carbon']} (band {r['band']})")
        return 0 if summary["pass_rate_pct"] >= 85 else 1

    if args.command == "case-study":
        from hydrawatch.case_study import run_india_vs_nordic_case_study
        cs = run_india_vs_nordic_case_study()
        print(cs["conclusion"])
        print(json.dumps(cs["findings"], indent=2))
        return 0 if cs["pass"] else 1

    if args.command == "gate":
        from hydrawatch.gate import run_deploy_gate
        gr = run_deploy_gate(
            args.provider, args.region, args.min_score, args.min_tier,
            args.qps, args.tokens, args.gpu, args.model,
        )
        print(gr.message)
        if gr.recommendation:
            print(f"Recommendation: {gr.recommendation}")
        return 0 if gr.passed else 1

    if args.command == "analyze" or args.command is None:
        if args.command is None:
            args.provider = "AWS"
            args.region = "ap-south-1"
            args.qps = 150
            args.tokens = 1000
            args.gpu = "A100"
            args.model = "LLaMA-3-70B"
            args.user_location = "India"
            args.max_latency = 150
            args.cost_tolerance = 10.0

        result = full_analysis(
            provider=args.provider,
            region_code=args.region,
            qps=args.qps,
            avg_tokens=args.tokens,
            gpu_type=args.gpu,
            model_name=args.model,
            user_location=args.user_location,
            max_latency_ms=args.max_latency,
            cost_tolerance_pct=args.cost_tolerance,
        )
        print_analysis(result)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
