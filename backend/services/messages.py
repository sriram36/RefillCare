"""Customer messages in English, Bengali and Hindi. Medicine names stay as printed on the pack."""

LANGS = ("en", "bn", "hi")


def refill_reminder(lang: str, med: str, person: str, days: int) -> str:
    days = max(days, 0)
    if lang == "bn":
        when = "আজ শেষ হবে" if days == 0 else f"আর প্রায় {days} দিন চলবে"
        return f"{person}-এর {med} {when}। এক ট্যাপে আবার অর্ডার করুন।"
    if lang == "hi":
        when = "आज खत्म हो रही है" if days == 0 else f"लगभग {days} दिन में खत्म होगी"
        return f"{person} की {med} {when}। एक टैप में दोबारा ऑर्डर करें।"
    when = "runs out today" if days == 0 else f"runs out in about {days} days"
    return f"{med} for {person} {when}. Reorder in one tap."
