"""Customer notifications. All of them are demo notifications: nothing leaves the app.

Every message is written to the customer's in-app messages and to an outbox the pharmacist can read. There is no SMS
or WhatsApp provider, no key and no cost. To go live, send the text from `notify` through a provider of your choice."""

import time
from datetime import date
from typing import Callable

from database.session import ex, q


def mask(phone: str) -> str:
    return f"{phone[:2]}••••••{phone[-2:]}" if phone and len(phone) >= 6 else "••••"


def notify(phone: str, text: str, customer_id: int | None = None, channel: str = "WhatsApp") -> None:
    """Record a message as 'sent'. This is the one place a real provider would be called."""
    print(f"[notify:demo] {channel} to {phone}: {text}", flush=True)
    ex(
        "insert into outbox(ts, customer_id, phone, channel, text) values(?, ?, ?, ?, ?)",
        int(time.time()), customer_id, phone, channel, text,
    )


def tell(customer_id: int, key: str, text_for: Callable[[str], str], channel: str = "SMS") -> bool:
    """Send a customer one message about an event, in their language, once per key. Returns False if already told."""
    user = q("select phone, lang from users where id = ?", customer_id, one=True)
    if not user or q("select 1 x from notes where customer_id = ? and key = ?", customer_id, key, one=True):
        return False
    text = text_for(user.get("lang") or "en")
    ex(
        "insert into notes(customer_id, text, ts, day, key) values(?, ?, ?, ?, ?)",
        customer_id, text, int(time.time()), date.today().isoformat(), key,
    )
    if user.get("phone"):
        notify(user["phone"], text, customer_id, channel)
    return True
