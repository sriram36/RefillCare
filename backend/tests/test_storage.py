import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from core import storage

def test_encrypted_storage_roundtrip():
    """Verify that file is saved encrypted and decrypted transparently."""
    test_filename = "test_prescription_rx123.enc"
    test_content = b"TEST_PRESCRIPTION_IMAGE_RAW_BINARY_DATA_12345"

    saved_name = storage.save_encrypted_rx(test_filename, test_content)
    assert saved_name == test_filename

    # Read back and decrypt
    decrypted = storage.get_decrypted_rx(test_filename)
    assert decrypted == test_content

    # Clean up
    deleted = storage.delete_rx(test_filename)
    assert deleted is True

def test_nonexistent_rx_raises_error():
    """Verify missing file raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        storage.get_decrypted_rx("non_existent_file_99999.enc")

