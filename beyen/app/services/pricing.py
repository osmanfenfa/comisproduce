"""
Core pricing calculations for COMIS.
Kept as pure functions so they're easy to unit test and reused by both
the API layer and (mirrored logic in) the frontend live-preview.

Money is computed with Decimal and rounded half-up to 2 places, so totals match
what a cashier would write by hand and never drift through float error.
Weights stay as floats (kg, rounded to 2 places).
"""
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def to_decimal(value) -> Decimal:
    """Convert int/float/str/Decimal to Decimal without float artefacts (0.1 -> 0.1, not 0.1000000000000000055)."""
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def to_money(value) -> Decimal:
    return to_decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def _round_kg(value: Decimal) -> float:
    return float(value.quantize(CENT, rounding=ROUND_HALF_UP))


def calculate_moisture_deduction_price(
    weight_kg: float, water_percent: float, standard_percent: float, price_per_kg
) -> dict:
    """
    Used for Cocoa.

    Excess moisture percentage above standard baseline is deducted proportionally
    from the gross weight:
      excess_percent = max(0.0, water_percent - standard_percent)
      moisture_deduction_kg = weight_kg * (excess_percent / 100.0)
      net_weight_kg = weight_kg - moisture_deduction_kg
      total_price = net_weight_kg * price_per_kg

    Example: weight=20kg, water_percent=12%, standard=7%, price=40
             -> excess=5%, deduction=20*0.05=1.0kg, net_weight=19.0kg, total_price=760.00
    """
    if water_percent < 0:
        raise ValueError("Water percentage cannot be negative.")

    weight = to_decimal(weight_kg)
    standard = to_decimal(standard_percent)
    computed_water = max(to_decimal(water_percent), standard)
    excess_percent = (computed_water - standard).quantize(CENT, rounding=ROUND_HALF_UP)
    moisture_deduction = (weight * excess_percent / 100).quantize(CENT, rounding=ROUND_HALF_UP)
    net_weight = weight - moisture_deduction

    if net_weight <= 0:
        raise ValueError("Net weight is zero or negative — check the entered values.")

    total_price = to_money(net_weight * to_decimal(price_per_kg))

    return {
        "moisture_deduction": _round_kg(moisture_deduction),
        "moisture_deduction_kg": _round_kg(moisture_deduction),
        "excess_percent": float(excess_percent),
        "net_weight_kg": _round_kg(net_weight),
        "total_price": total_price,
    }


def calculate_direct_price(weight_kg: float, price_per_kg) -> Decimal:
    """Used for Coffee and Cola (and future Spice) — simple weight x price, no deduction."""
    return to_money(to_decimal(weight_kg) * to_decimal(price_per_kg))


def calculate_loan_balance(loan_taken, total_paid) -> Decimal:
    return to_money(to_decimal(loan_taken) - to_decimal(total_paid))
