"""Each test module starts from its own freshly seeded database and prescription store.

Without this, modules share whichever temp database was set last at import time, so stock used
up by one module's packed orders leaks into the next.
"""

import os
import shutil
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# backend/.env may hold real AI keys and the app loads it on its own. Empty strings (not removal) stop that,
# so no test can ever call an outside service.
os.environ["AZURE_OPENAI_ENDPOINT"] = ""
os.environ["AZURE_OPENAI_KEY"] = ""


@pytest.fixture(autouse=True, scope="module")
def fresh_database():
    keys = ("DB_PATH", "RX_STORE_PATH")
    saved = {k: os.environ.get(k) for k in keys}
    workdir = tempfile.mkdtemp(prefix="refillcare-test-")
    os.environ["DB_PATH"] = os.path.join(workdir, "test.db")
    os.environ["RX_STORE_PATH"] = os.path.join(workdir, "rx")

    from database.seed import init

    init()
    yield
    for k, v in saved.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    shutil.rmtree(workdir, ignore_errors=True)
