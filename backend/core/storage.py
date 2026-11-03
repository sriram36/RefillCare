import logging
import os
from core.config import (
    AZURE_STORAGE_CONNECTION_STRING,
    AZURE_STORAGE_CONTAINER,
    STORE,
)
from core.crypto import encrypt_bytes, decrypt_bytes

logger = logging.getLogger("refillcare.storage")


def _get_store_dir() -> str:
    store_dir = os.getenv("RX_STORE_PATH", STORE)
    os.makedirs(store_dir, exist_ok=True)
    return store_dir


def is_cloud_storage() -> bool:
    return bool(AZURE_STORAGE_CONNECTION_STRING)


def save_encrypted_rx(filename: str, raw_bytes: bytes) -> str:
    """
    Encrypt raw image bytes with AES-128 Fernet and save to cloud blob storage
    or local encrypted storage.
    """
    encrypted_data = encrypt_bytes(raw_bytes)

    if AZURE_STORAGE_CONNECTION_STRING:
        try:
            from azure.storage.blob import BlobServiceClient
            blob_service = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            container_client = blob_service.get_container_client(AZURE_STORAGE_CONTAINER)
            if not container_client.exists():
                container_client.create_container()
            blob_client = container_client.get_blob_client(filename)
            blob_client.upload_blob(encrypted_data, overwrite=True)
            logger.info(f"Saved encrypted prescription {filename} to Azure Blob Storage.")
            return filename
        except Exception as e:
            logger.warning(f"Azure Blob upload failed ({e}). Falling back to local encrypted disk.")

    # Local encrypted disk fallback
    out_path = os.path.join(_get_store_dir(), filename)
    with open(out_path, "wb") as f:
        f.write(encrypted_data)
    return filename


def get_decrypted_rx(filename: str) -> bytes:
    """
    Retrieve and decrypt prescription bytes from cloud blob or local storage.
    """
    if AZURE_STORAGE_CONNECTION_STRING:
        try:
            from azure.storage.blob import BlobServiceClient
            blob_service = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            blob_client = blob_service.get_blob_client(
                container=AZURE_STORAGE_CONTAINER, blob=filename
            )
            if blob_client.exists():
                encrypted_data = blob_client.download_blob().readall()
                return decrypt_bytes(encrypted_data)
        except Exception as e:
            logger.warning(f"Azure Blob download failed ({e}). Checking local disk fallback.")

    # Local encrypted disk fallback
    in_path = os.path.join(_get_store_dir(), filename)
    if not os.path.exists(in_path):
        raise FileNotFoundError(f"Prescription file not found: {filename}")
    with open(in_path, "rb") as f:
        return decrypt_bytes(f.read())


def delete_rx(filename: str) -> bool:
    """
    Permanently delete encrypted prescription (for DPDP Act Right-to-Erasure compliance).
    """
    deleted = False
    if AZURE_STORAGE_CONNECTION_STRING:
        try:
            from azure.storage.blob import BlobServiceClient
            blob_service = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            blob_client = blob_service.get_blob_client(
                container=AZURE_STORAGE_CONTAINER, blob=filename
            )
            if blob_client.exists():
                blob_client.delete_blob()
                deleted = True
        except Exception as e:
            logger.warning(f"Azure Blob deletion failed: {e}")

    in_path = os.path.join(_get_store_dir(), filename)
    if os.path.exists(in_path):
        try:
            os.remove(in_path)
            deleted = True
        except OSError:
            pass
    return deleted
