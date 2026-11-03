import os
from cryptography.fernet import Fernet
from core.config import FKEY, STORE

fernet = Fernet(FKEY)


def encrypt_bytes(data: bytes) -> bytes:
    """Encrypt raw image bytes using AES-128 Fernet encryption."""
    return fernet.encrypt(data)


def decrypt_bytes(encrypted_data: bytes) -> bytes:
    """Decrypt encrypted image bytes using Fernet."""
    return fernet.decrypt(encrypted_data)


def save_encrypted_prescription(filename: str, raw_bytes: bytes) -> str:
    """Save encrypted prescription to disk and return the filename."""
    enc = encrypt_bytes(raw_bytes)
    out_path = os.path.join(STORE, filename)
    with open(out_path, "wb") as f:
        f.write(enc)
    return filename


def read_encrypted_prescription(filename: str) -> bytes:
    """Read and decrypt prescription from disk."""
    in_path = os.path.join(STORE, filename)
    if not os.path.exists(in_path):
        raise FileNotFoundError(f"Prescription file not found: {filename}")
    with open(in_path, "rb") as f:
        return decrypt_bytes(f.read())
