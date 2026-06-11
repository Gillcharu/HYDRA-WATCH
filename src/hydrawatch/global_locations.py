"""Global user audience locations for latency modeling."""

from __future__ import annotations

GLOBAL_USER_LOCATIONS: dict[str, tuple[float, float, str]] = {
    "Mumbai, India": (19.08, 72.88, "Asia-Pacific"),
    "Delhi, India": (28.61, 77.21, "Asia-Pacific"),
    "Bangalore, India": (12.97, 77.59, "Asia-Pacific"),
    "Singapore": (1.35, 103.82, "Asia-Pacific"),
    "Tokyo, Japan": (35.68, 139.69, "Asia-Pacific"),
    "Seoul, South Korea": (37.57, 126.98, "Asia-Pacific"),
    "Sydney, Australia": (-33.87, 151.21, "Asia-Pacific"),
    "Melbourne, Australia": (-37.81, 144.96, "Asia-Pacific"),
    "Jakarta, Indonesia": (-6.21, 106.85, "Asia-Pacific"),
    "Hong Kong": (22.32, 114.17, "Asia-Pacific"),
    "Shanghai, China": (31.23, 121.47, "Asia-Pacific"),
    "Beijing, China": (39.90, 116.41, "Asia-Pacific"),
    "Taipei, Taiwan": (25.03, 121.57, "Asia-Pacific"),
    "Bangkok, Thailand": (13.76, 100.50, "Asia-Pacific"),
    "Dubai, UAE": (25.20, 55.27, "Asia-Pacific"),
    "London, UK": (51.51, -0.13, "Europe"),
    "Frankfurt, Germany": (50.11, 8.68, "Europe"),
    "Amsterdam, Netherlands": (52.37, 4.90, "Europe"),
    "Paris, France": (48.86, 2.35, "Europe"),
    "Stockholm, Sweden": (59.33, 18.07, "Europe"),
    "Oslo, Norway": (59.91, 10.75, "Europe"),
    "Helsinki, Finland": (60.17, 24.94, "Europe"),
    "Dublin, Ireland": (53.35, -6.26, "Europe"),
    "Zurich, Switzerland": (47.37, 8.54, "Europe"),
    "Madrid, Spain": (40.42, -3.70, "Europe"),
    "Milan, Italy": (45.46, 9.19, "Europe"),
    "Warsaw, Poland": (52.23, 21.01, "Europe"),
    "New York, USA": (40.71, -74.01, "Americas"),
    "Virginia, USA": (39.04, -77.49, "Americas"),
    "California, USA": (37.34, -121.89, "Americas"),
    "Oregon, USA": (45.84, -119.70, "Americas"),
    "Texas, USA": (31.97, -99.90, "Americas"),
    "Chicago, USA": (41.88, -87.63, "Americas"),
    "São Paulo, Brazil": (-23.55, -46.63, "Americas"),
    "Toronto, Canada": (43.65, -79.38, "Canada"),
    "Montreal, Canada": (45.50, -73.57, "Canada"),
    "Mexico City, Mexico": (19.43, -99.13, "Americas"),
    "Cape Town, South Africa": (-33.92, 18.42, "Africa"),
    "Johannesburg, South Africa": (-26.20, 28.04, "Africa"),
    "Lagos, Nigeria": (6.52, 3.38, "Africa"),
    "Nairobi, Kenya": (-1.29, 36.82, "Africa"),
    "Tel Aviv, Israel": (32.09, 34.78, "Middle East"),
    "Riyadh, Saudi Arabia": (24.71, 46.67, "Middle East"),
}

LEGACY_ALIASES = {
    "India": "Mumbai, India",
    "United States": "Virginia, USA",
    "Europe": "Frankfurt, Germany",
    "Singapore": "Singapore",
    "Australia": "Sydney, Australia",
    "Japan": "Tokyo, Japan",
    "Brazil": "São Paulo, Brazil",
}


def coords(name: str) -> tuple[float, float] | None:
    resolved = LEGACY_ALIASES.get(name, name)
    entry = GLOBAL_USER_LOCATIONS.get(resolved)
    return (entry[0], entry[1]) if entry else None


def all_location_names() -> list[str]:
    return sorted(GLOBAL_USER_LOCATIONS.keys())


def locations_by_continent() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for name, (_, _, continent) in GLOBAL_USER_LOCATIONS.items():
        out.setdefault(continent, []).append(name)
    return {k: sorted(v) for k, v in sorted(out.items())}


def resolve_location(name: str) -> str:
    return LEGACY_ALIASES.get(name, name)
