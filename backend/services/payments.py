import hashlib
import hmac
import time
from core.config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET


def generate_test_signature(order_id: str, payment_id: str) -> str:
    msg = f"{order_id}|{payment_id}"
    return hmac.new(RAZORPAY_KEY_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    if not signature:
        return False
    expected = generate_test_signature(order_id, payment_id)
    return hmac.compare_digest(expected, signature)


def verify_webhook_signature(raw_body: bytes, signature: str | None, secret: str | None) -> bool:
    """Razorpay signs the raw webhook body with HMAC-SHA256. No secret configured means the webhook is closed."""
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def create_payment_order(order_code: str, amount_in_rupees: int) -> dict:
    """Create a Razorpay / UPI payment order."""
    now = int(time.time())
    razorpay_order_id = f"order_{order_code.replace('-', '_').lower()}_{now}"
    amount_in_paise = max(100, int(amount_in_rupees * 100))
    return {
        "razorpay_order_id": razorpay_order_id,
        "amount": amount_in_paise,
        "amount_rupees": amount_in_rupees,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID,
        "order_code": order_code,
        "upi_vpa": "refillcare.kolkata@okhdfcbank",
    }

