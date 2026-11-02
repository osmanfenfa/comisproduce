"""Sierra Leone administrative areas used for seller traceability."""

# The 16 districts (2017 administrative boundaries)
DISTRICTS = [
    "Bo", "Bombali", "Bonthe", "Falaba", "Kailahun", "Kambia", "Karene", "Kenema",
    "Koinadugu", "Kono", "Moyamba", "Port Loko", "Pujehun", "Tonkolili",
    "Western Area Rural", "Western Area Urban",
]

_BY_KEY = {d.lower(): d for d in DISTRICTS}


def normalize_district(value: str | None) -> str | None:
    """Canonical district name, or None if blank. Accepts 'kenema', 'Kenema District', etc."""
    if not value or not value.strip():
        return None
    key = " ".join(value.strip().lower().split())
    if key.endswith(" district"):
        key = key[: -len(" district")]
    return _BY_KEY.get(key)
