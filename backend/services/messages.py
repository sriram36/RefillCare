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


def order_update(lang: str, event: str, code: str, store: str = "", reason: str = "") -> str:
    """One short line about an order. `event` is approved, rejected, on_hold, packed or dispatched."""
    if lang == "bn":
        lines = {
            "approved": f"অর্ডার {code} অনুমোদিত হয়েছে।" + (f" {store} এটি প্যাক করবে।" if store else " আমরা একটি দোকান খুঁজছি।"),
            "rejected": f"অর্ডার {code} এগোতে পারেনি। অ্যাপে বিস্তারিত দেখুন।",
            "on_hold": f"অর্ডার {code}-এর জন্য প্রেসক্রিপশনের একটি স্পষ্ট ছবি দরকার।",
            "packed": f"অর্ডার {code} প্যাক হয়েছে, ডেলিভারিতে দেওয়ার অপেক্ষায়।",
            "dispatched": f"অর্ডার {code} পথে আছে।",
        }
    elif lang == "hi":
        lines = {
            "approved": f"ऑर्डर {code} मंज़ूर हो गया।" + (f" {store} इसे पैक करेगा।" if store else " हम एक स्टोर ढूंढ रहे हैं।"),
            "rejected": f"ऑर्डर {code} आगे नहीं बढ़ सका। ऐप में ब्योरा देखें।",
            "on_hold": f"ऑर्डर {code} के लिए प्रेसक्रिप्शन की साफ़ फ़ोटो चाहिए।",
            "packed": f"ऑर्डर {code} पैक हो गया, डिलीवरी के लिए तैयार।",
            "dispatched": f"ऑर्डर {code} रास्ते में है।",
        }
    else:
        lines = {
            "approved": f"Order {code} is approved." + (f" {store} will pack it next." if store else " We are finding a store."),
            "rejected": f"Order {code} could not go ahead. See the app for details.",
            "on_hold": f"Order {code} needs a clearer photo of the prescription.",
            "packed": f"Order {code} is packed and waiting for delivery.",
            "dispatched": f"Order {code} is on its way.",
        }
    return lines[event]
