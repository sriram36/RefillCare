import base64
import hashlib
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Auto-load .env file if present
_env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(_env_path):
    with open(_env_path, "r", encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                _k, _v = _k.strip(), _v.strip().strip("'\"")
                if _k and _k not in os.environ:
                    os.environ[_k] = _v

DATABASE_URL = os.getenv("DATABASE_URL")
DB = os.getenv("DB_PATH", os.path.join(BASE_DIR, "pharmacy.db"))
SECRET = os.getenv("APP_SECRET", "dev-only-secret")
FKEY = os.getenv("RX_ENC_KEY") or base64.urlsafe_b64encode(
    hashlib.sha256(SECRET.encode()).digest()
)
STORE = os.getenv("RX_STORE_PATH", os.path.join(BASE_DIR, "rx_store"))
os.makedirs(STORE, exist_ok=True)

# Cloud Storage Configuration (Azure Blob / S3)
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "prescriptions")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")

# Payment Gateway Configuration (Razorpay)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "rzp_test_refillcare_demo")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "refillcare_secret_demo")

AREAS = {
    "Park Street": (22.5535, 88.3520),
    "Salt Lake": (22.5867, 88.4171),
    "Behala": (22.4985, 88.3118),
    "Howrah": (22.5800, 88.3250),
}  # Kolkata/Howrah sample coordinates

AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_KEY = os.getenv("AZURE_OPENAI_KEY")
AZURE_DEPLOY = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna")

# Allowed CORS origins (comma-separated list, e.g. "http://localhost:3000,https://my-app.vercel.app")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
