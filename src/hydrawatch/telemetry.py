"""Mock live datacenter telemetry provider (PUE/WUE shifts based on daily temp cycles)."""

from __future__ import annotations

from datetime import datetime, timezone
import math


def get_live_telemetry(region_code: str) -> dict[str, float]:
    """
    Simulate live dynamic telemetry fluctuations (PUE & WUE)
    based on diurnal temperature cycles (sinusoidal variation over time).
    """
    from hydrawatch.constants import PUE
    from hydrawatch.wue_data import get_wue
    
    base_pue = PUE.get(region_code, PUE["DEFAULT"])
    base_wue = get_wue(region_code)
    
    # Diurnal shift: peak at 14:00 (2 PM) local/UTC solar time
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0
    
    # Cosine wave peak at hour 14
    diurnal_factor = math.cos((hour - 14.0) * (2 * math.pi / 24.0))
    
    # PUE fluctuates by +/- 5%
    pue_variation = base_pue * 0.05 * diurnal_factor
    live_pue = max(1.01, base_pue + pue_variation)
    
    # WUE fluctuates by +/- 15%
    wue_variation = base_wue * 0.15 * diurnal_factor
    live_wue = max(0.05, base_wue + wue_variation)
    
    return {
        "pue": round(live_pue, 3),
        "wue": round(live_wue, 3),
    }
