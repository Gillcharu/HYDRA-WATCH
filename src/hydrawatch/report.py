"""Exportable compliance-style reports with Scope 2/3 and PDF."""

from __future__ import annotations

import io
import json
from datetime import datetime, timezone

from hydrawatch.provenance import DATASET_VERSION, METHODOLOGY_VERSION, footprint_provenance
from hydrawatch.scope23 import scope23_report


def build_audit_report(result: dict, params: dict) -> dict:
    c = result["current"]
    fp = c["footprint"]
    best = (result.get("multicloud") or result.get("alternatives") or [None])[0]
    footprint_dict = {
        "water_L_month": {"mid": fp.water_month.mid, "low": fp.water_month.low, "high": fp.water_month.high},
        "carbon_kg_month": {"mid": fp.carbon_month.mid, "low": fp.carbon_month.low, "high": fp.carbon_month.high},
        "cost_usd_month": fp.cost_month_usd,
        "gpus": fp.gpus_needed,
        "assumptions": fp.assumptions,
    }
    return {
        "report_type": "HydraWatch Sustainability Assessment",
        "methodology_version": METHODOLOGY_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": result["disclaimer"],
        "estimate_tier": fp.tier,
        "inputs": params,
        "best_action": {
            "headline": (
                f"Move {params.get('model', 'workload')} from {params.get('provider')} {c.get('region_name')} "
                f"to {best.get('provider')} {best.get('region_name')}"
            ) if best else "No SLA-fit alternative found",
            "water_savings_pct": best.get("water_savings_pct") if best else 0,
            "carbon_savings_pct": best.get("carbon_savings_pct") if best else 0,
            "cost_month_usd": best.get("cost_month_usd") if best else fp.cost_month_usd,
            "confidence": c.get("data_confidence", "medium"),
        },
        "current_region": {k: v for k, v in c.items() if k not in ("footprint", "score_components")},
        "score_components": c.get("score_components", {}),
        "footprint": footprint_dict,
        "provenance": footprint_provenance(c),
        "alternatives_same_provider": result.get("alternatives", []),
        "alternatives_multicloud": result.get("multicloud", []),
        "validation": result.get("validation", []),
        "verification": result.get("verification", {}),
        "footprint_verification_tier": result.get("verification", {}).get("footprint_tier", "V0"),
        "dataset_version": DATASET_VERSION,
        "scope23": result.get("scope23") or scope23_report(footprint_dict, c),
        "anomalies": result.get("anomalies", []),
        "forecast": result.get("forecast", []),
    }


def render_html_report(audit: dict) -> str:
    c = audit["current_region"]
    fp = audit["footprint"]
    action = audit.get("best_action", {})
    alts = audit.get("alternatives_multicloud", audit.get("alternatives_same_provider", []))
    s23 = audit.get("scope23", {})

    alt_rows = ""
    for a in alts[:5]:
        tag = " ★ Pareto" if a.get("pareto_improvement") else ""
        mig = f" (mig ${a.get('migration_cost_usd', 0):,})" if a.get("migration_cost_usd") else ""
        alt_rows += f"""
        <tr>
          <td>{a.get('rank', '')}</td>
          <td>{a.get('provider', '')} {a.get('region_name', '')}</td>
          <td>{a.get('adjusted_score', a.get('sustainability_score', ''))}</td>
          <td>{a.get('water_month_L', 0):,.0f}</td>
          <td>{a.get('carbon_month_kg', 0):,.0f}</td>
          <td>${a.get('cost_month_usd', 0):,.0f}{mig}</td>
          <td>{tag}</td>
        </tr>"""

    prov_rows = ""
    for p in audit.get("provenance", []):
        prov_rows += f"<tr><td>{p['metric']}</td><td>{p.get('source', '')}</td><td>{p.get('field_confidence', p.get('confidence', ''))}</td></tr>"

    val_rows = ""
    for v in audit.get("validation", []):
        icon = "✓" if v.get("pass") else "?"
        val_rows += f"<tr><td>{icon}</td><td>{v.get('title','')}</td><td>{v.get('metric','')}</td><td>{v.get('published','')}</td><td>{v.get('modeled', v.get('modeled_water',''))}</td></tr>"

    scope2 = s23.get("scope2", {})
    limitations = "".join(f"<li>{x}</li>" for x in s23.get("limitations", []))

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>HydraWatch Report</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; color: #1e293b; }}
  h1 {{ color: #0f766e; }} .warn {{ background: #fffbeb; border-left: 4px solid #f59e0b; padding: 1rem; }}
  table {{ border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }}
  th, td {{ border: 1px solid #e2e8f0; padding: 0.5rem; text-align: left; }}
  th {{ background: #f0fdfa; }}
  .meta {{ color: #64748b; font-size: 0.9rem; }}
  @media print {{ body {{ margin: 1cm; }} }}
</style></head><body>
<h1>HydraWatch Sustainability Assessment</h1>
<p class="meta">Generated {audit['generated_at']} · Methodology v{audit['methodology_version']} · Tier {audit['estimate_tier']}</p>
<div class="warn">{audit['disclaimer']}</div>

<h2>Current deployment</h2>
<p><strong>{c.get('region_name', '')}</strong> ({c.get('region_code', '')}) — {c.get('city', '')}, {c.get('country', '')}</p>
<p>Sustainability score: <strong>{c.get('sustainability_score', '')}/100</strong> · Carbon data: {c.get('carbon_mode', 'static')}</p>
<ul>
  <li>Water: {fp['water_L_month']['mid']:,.0f} L/mo (range {fp['water_L_month']['low']:,.0f}–{fp['water_L_month']['high']:,.0f})</li>
  <li>Carbon (Scope 2 est.): {fp['carbon_kg_month']['mid']:,.0f} kg CO₂/mo</li>
  <li>GPU cost: ${fp['cost_usd_month']:,.0f}/mo ({fp['gpus']} GPUs)</li>
</ul>

<h2>Executive recommendation</h2>
<p><strong>{action.get('headline', '')}</strong></p>
<ul>
  <li>Estimated water savings: {action.get('water_savings_pct', 0)}%</li>
  <li>Estimated carbon savings: {action.get('carbon_savings_pct', 0)}%</li>
  <li>Projected monthly cost: ${action.get('cost_month_usd', 0):,.0f}</li>
  <li>Confidence: {str(action.get('confidence', '')).upper()}</li>
</ul>

<h2>Scope 2 / 3 alignment</h2>
<p><strong>{s23.get('ghg_protocol_alignment', '')}</strong></p>
<ul>
  <li>Scope 2 method: {scope2.get('method', '')}</li>
  <li>Grid factor: {scope2.get('grid_factor_kg_kwh', '')} kg/kWh ({scope2.get('grid_source', '')})</li>
  <li>Water withdrawal proxy: {s23.get('scope3', {}).get('water_withdrawal_L_month', 'N/A'):,.0f} L/mo</li>
</ul>
<ul>{limitations}</ul>

<h2>Validation</h2>
<table><tr><th></th><th>Check</th><th>Metric</th><th>Published</th><th>Modeled</th></tr>{val_rows}</table>

<h2>Recommended alternatives</h2>
<table>
  <tr><th>#</th><th>Region</th><th>Adj. score</th><th>Water L</th><th>Carbon kg</th><th>Cost</th><th></th></tr>
  {alt_rows}
</table>

<h2>Data provenance</h2>
<table><tr><th>Metric</th><th>Source</th><th>Confidence</th></tr>{prov_rows}</table>

<h2>Assumptions</h2>
<ul>{''.join(f'<li>{a}</li>' for a in fp.get('assumptions', []))}</ul>
</body></html>"""


def render_pdf_report(audit: dict) -> bytes | None:
    """Generate PDF bytes via reportlab."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib import colors
    except ImportError:
        return None

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    c = audit["current_region"]
    fp = audit["footprint"]
    action = audit.get("best_action", {})

    story.append(Paragraph("HydraWatch Sustainability Assessment", styles["Title"]))
    story.append(Paragraph(
        f"Methodology v{audit['methodology_version']} · {audit['generated_at'][:10]}", styles["Normal"]
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph(audit["disclaimer"], styles["Normal"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        f"<b>{c.get('region_name')}</b> — Score {c.get('sustainability_score')}/100", styles["Heading2"]
    ))
    story.append(Paragraph(
        f"Water: {fp['water_L_month']['mid']:,.0f} L/mo · "
        f"Carbon: {fp['carbon_kg_month']['mid']:,.0f} kg/mo · "
        f"Cost: ${fp['cost_usd_month']:,.0f}/mo", styles["Normal"]
    ))
    story.append(Spacer(1, 12))
    story.append(Paragraph("Executive recommendation", styles["Heading2"]))
    story.append(Paragraph(action.get("headline", ""), styles["Normal"]))
    story.append(Paragraph(
        f"Water savings: {action.get('water_savings_pct', 0)}% · "
        f"Carbon savings: {action.get('carbon_savings_pct', 0)}% · "
        f"Confidence: {str(action.get('confidence', '')).upper()}",
        styles["Normal"],
    ))

    s23 = audit.get("scope23", {})
    story.append(Spacer(1, 12))
    story.append(Paragraph("Scope 2/3", styles["Heading2"]))
    story.append(Paragraph(s23.get("ghg_protocol_alignment", ""), styles["Normal"]))

    alts = audit.get("alternatives_multicloud", [])[:5]
    if alts:
        story.append(Spacer(1, 12))
        story.append(Paragraph("Top alternatives", styles["Heading2"]))
        data = [["#", "Region", "Score", "Carbon kg", "Saved %"]]
        for a in alts:
            data.append([
                str(a.get("rank", "")),
                f"{a.get('provider', '')} {a.get('region_name', '')}",
                str(a.get("adjusted_score", a.get("sustainability_score", ""))),
                f"{a.get('carbon_month_kg', 0):,.0f}",
                f"{a.get('carbon_savings_pct', 0)}%",
            ])
        t = Table(data)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.teal),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(t)

    doc.build(story)
    return buf.getvalue()
