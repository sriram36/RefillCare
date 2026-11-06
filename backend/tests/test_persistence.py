import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from database import session

def test_sqlite_fallback_and_querying():
    """Verify default SQLite engine functions properly."""
    assert not session.is_postgres()
    res = session.q("SELECT count(*) as count FROM stores", one=True)
    assert res is not None
    assert "count" in res
    assert res["count"] >= 3

def test_sql_translation_helper():
    """Verify ? to %s parameter translation for PostgreSQL compatibility."""
    sql = "SELECT * FROM orders WHERE code = ? AND customer_id = ?"
    translated = session.to_pg_sql(sql)
    assert translated == "SELECT * FROM orders WHERE code = %s AND customer_id = %s"

def test_ensure_schema_idempotency():
    """Verify ensure_schema runs without throwing errors."""
    session.ensure_schema()
    res = session.q("SELECT name FROM sqlite_master WHERE type='table'")
    assert len(res) > 0
