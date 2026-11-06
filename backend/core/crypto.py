from cryptography.fernet import Fernet
from core.config import FKEY

fernet = Fernet(FKEY)


def encrypt_bytes(data: bytes) -> bytes:
    """Encrypt raw image bytes using AES-128 Fernet encryption."""
    return fernet.encrypt(data)


def decrypt_bytes(encrypted_data: bytes) -> bytes:
    """Decrypt encrypted image bytes using Fernet."""
    return fernet.decrypt(encrypted_data)
