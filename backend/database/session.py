import logging
import os
import sqlite3
import time
from core.config import DB, DATABASE_URL

logger = logging.getLogger("refillcare.database")

SCHEMA = """
create table users(id integer primary key, name, phone unique, role, store_id, consent_at, token_ver default 1, lang default 'en');
create table meds(id integer primary key, name, schedule, price, generic_of);
create table stores(id integer primary key, name, lat, lng);
create table stock(store_id, med_id, qty, primary key(store_id, med_id));
create table orders(code primary key, customer_id, for_name, status, store_id, rx_file, note, created, verified_at, invoice_no, payment default 'cod', paid default 0, area default 'Park Street', payment_ref, delivery_partner, rx_reused default 0);
create table items(id integer primary key, order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason, offer, consent, original_price);
create table refills(id integer primary key, customer_id, for_name, med_id, qty, per_day, last_filled);
create table audit(ts, actor, action, entity);
create table profiles(id integer primary key, customer_id, name, relation, is_minor default 0, guardian_consent default 0);
create table notes(customer_id, text, ts, day, key);
create table register(order_code, item_id, prescriber, patient, qty, ts);
create table prescriptions(id integer primary key, customer_id, profile_name, order_code, rx_file, approved_at, valid_until);
create table subscriptions(id integer primary key, customer_id, for_name, med_id, qty, per_day, frequency_days default 30, next_refill, active default 1, created integer);
create table transfers(id integer primary key, from_store_id integer, to_store_id integer, med_id integer, qty integer, status text default 'requested', requested_at integer, fulfilled_at integer);
"""

_PG_ACTIVE = False
_PG_POOL = None


def is_postgres() -> bool:
    global _PG_ACTIVE
    if not DATABASE_URL:
        return False
    return _PG_ACTIVE


def to_pg_sql(sql: str) -> str:
    """Translate SQLite '?' parameters to PostgreSQL '%s'."""
    return sql.replace("?", "%s")


def _init_pg_pool():
    global _PG_ACTIVE, _PG_POOL
    if not DATABASE_URL:
        _PG_ACTIVE = False
        return
    try:
        import psycopg2
        import psycopg2.pool
        _PG_POOL = psycopg2.pool.SimpleConnectionPool(1, 10, DATABASE_URL)
        _PG_ACTIVE = True
        logger.info("Connected to PostgreSQL production cluster.")
    except Exception as e:
        logger.warning(f"Failed to connect to PostgreSQL ({e}). Falling back to SQLite.")
        _PG_ACTIVE = False
        _PG_POOL = None


_init_pg_pool()


def db():
    """Return a raw connection: SQLite by default, or fallback."""
    db_path = os.getenv("DB_PATH", DB)
    connection = sqlite3.connect(db_path, timeout=20.0)
    connection.execute("PRAGMA journal_mode=WAL;")
    connection.row_factory = sqlite3.Row
    return connection


def q(sql: str, *args, one: bool = False):
    """Execute read query and return list of dicts (or single dict if one=True)."""
    global _PG_ACTIVE, _PG_POOL
    if is_postgres() and _PG_POOL:
        conn = _PG_POOL.getconn()
        try:
            import psycopg2.extras
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(to_pg_sql(sql), args)
                rows = [dict(r) for r in cur.fetchall()]
                return (rows[0] if rows else None) if one else rows
        finally:
            _PG_POOL.putconn(conn)
    else:
        connection = db()
        cursor = connection.execute(sql, args)
        rows = [dict(row) for row in cursor]
        connection.close()
        return (rows[0] if rows else None) if one else rows


def _write(sql: str, args: tuple) -> tuple:
    """Run one write statement. Returns (lastrowid, rowcount) on either engine."""
    if is_postgres() and _PG_POOL:
        conn = _PG_POOL.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(to_pg_sql(sql), args)
                conn.commit()
                return getattr(cur, "lastrowid", None), cur.rowcount
        except Exception:
            conn.rollback()  # never hand an aborted transaction back to the pool
            raise
        finally:
            _PG_POOL.putconn(conn)
    connection = db()
    try:
        cursor = connection.execute(sql, args)
        connection.commit()
        return cursor.lastrowid, cursor.rowcount
    finally:
        connection.close()


def ex(sql: str, *args):
    """Execute write query and return lastrowid."""
    return _write(sql, args)[0]


def exc(sql: str, *args) -> int:
    """Execute write query and return the number of rows it changed."""
    return _write(sql, args)[1]


def log(actor: str, action: str, entity: str):
    ex(
        "insert into audit values(?, ?, ?, ?)",
        int(time.time()),
        actor,
        action,
        entity,
    )


def ensure_schema():
    """Ensure all required tables and columns exist idempotently."""
    connection = db()
    connection.execute(
        "create table if not exists prescriptions(id integer primary key, customer_id, profile_name, order_code, rx_file, approved_at, valid_until)"
    )
    connection.execute(
        "create table if not exists subscriptions(id integer primary key, customer_id, for_name, med_id, qty, per_day, frequency_days default 30, next_refill, active default 1, created integer)"
    )
    connection.execute(
        "create table if not exists transfers(id integer primary key, from_store_id integer, to_store_id integer, med_id integer, qty integer, status text default 'requested', requested_at integer, fulfilled_at integer)"
    )

    for col, ddl in [
        ("consent_at", "alter table users add column consent_at integer"),
        ("token_ver", "alter table users add column token_ver integer default 1"),
        ("is_minor", "alter table profiles add column is_minor integer default 0"),
        ("guardian_consent", "alter table profiles add column guardian_consent integer default 0"),
        ("payment_ref", "alter table orders add column payment_ref text"),
        ("delivery_partner", "alter table orders add column delivery_partner text"),
        ("original_price", "alter table items add column original_price integer"),
        ("rx_reused", "alter table orders add column rx_reused integer default 0"),
        ("lang", "alter table users add column lang text default 'en'"),
        ("key", "alter table notes add column key text"),
    ]:
        try:
            connection.execute(ddl)
        except sqlite3.OperationalError:
            pass
    connection.commit()
    connection.close()
