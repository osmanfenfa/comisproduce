"""
Mobile-money payouts to sellers — PLACEHOLDER, NOT ACTIVE.

This defines where mobile-money payouts will plug in. Nothing here moves money,
calls Orange, or is used by the receipt flow: receipts are still settled in cash
exactly as before. To go live later:
  1. Get an Orange Money merchant / disbursement API account (Orange Sierra Leone).
  2. Implement OrangeMoneyProvider.send_payout() against their API (OAuth token,
     disbursement request, status callback), using ORANGE_MONEY_* settings.
  3. Record each payout attempt in its own table and link it to the receipt.
  4. Flip `enabled` only after end-to-end testing in Orange's sandbox.
"""
from dataclasses import dataclass
from decimal import Decimal


class PayoutNotAvailable(Exception):
    """Raised by every provider that is not live yet."""


@dataclass
class PayoutProviderInfo:
    id: str
    name: str
    available: bool
    status: str          # "active" | "coming_soon"
    note: str


@dataclass
class PayoutRequest:
    receipt_id: str
    msisdn: str          # seller's mobile-money number, e.g. +23276123456
    amount: Decimal
    currency: str = "SLE"


class PayoutProvider:
    info: PayoutProviderInfo

    def send_payout(self, request: PayoutRequest) -> str:
        """Returns the provider's transaction reference."""
        raise NotImplementedError


class CashProvider(PayoutProvider):
    """Today's behaviour: the station pays cash and issues the receipt."""
    info = PayoutProviderInfo(
        id="cash", name="Cash", available=True, status="active",
        note="Seller is paid in cash at the station.",
    )

    def send_payout(self, request: PayoutRequest) -> str:
        return "cash"


class OrangeMoneyProvider(PayoutProvider):
    info = PayoutProviderInfo(
        id="orange_money", name="Orange Money", available=False, status="coming_soon",
        note="Mobile-money payouts via Orange Money are not enabled yet.",
    )

    def send_payout(self, request: PayoutRequest) -> str:
        raise PayoutNotAvailable("Orange Money payouts are not enabled yet.")


PROVIDERS: dict[str, PayoutProvider] = {
    "cash": CashProvider(),
    "orange_money": OrangeMoneyProvider(),
}
