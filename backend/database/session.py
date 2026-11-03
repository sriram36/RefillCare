import sqlite3
import time
from core.config import DB

SCHEMA = """
create table users(id integer primary key, name, phone unique, role, store_id, consent_at, token_ver default 1);
create table meds(id integer primary key, name, schedule, price, generic_of);
create table stores(id integer primary key, name, lat, lng);
create table stock(store_id, med_id, qty, primary key(store_id, med_id));
create table orders(code primary key, customer_id, for_name, status, store_id, rx_file, note, created, verified_at, invoice_no, payment default 'cod', paid default 0, area default 'Park Street', payment_ref, delivery_partner);
create table items(id integer primary key, order_code, med_id, name, schedule, qty, price, conf, status, approved_by, reason, offer, consent, original_price);
create table refills(id integer primary key, customer_id, for_name, med_id, qty, per_day, last_filled);
create table audit(ts, actor, action, entity);
create table profiles(id integer primary key, customer_id, name, relation, is_minor default 0, guardian_consent default 0);
create table notes(customer_id, text, ts, day);
create table register(order_code, item_id, prescriber, patient, qty, ts);
create table prescriptions(id integer primary key, customer_id, profile_name, order_code, rx_file, approved_at, valid_until);
"""


def db():
    connection = sqlite3.connect(DB)
    connection.row_factory = sqlite3.Row
    return connection


def q(sql: str, *args, one: bool = False):
    connection = db()
    cursor = connection.execute(sql, args)
    rows = [dict(row) for row in cursor]
    connection.close()
    return (rows[0] if rows else None) if one else rows


def ex(sql: str, *args):
    connection = db()
    cursor = connection.execute(sql, args)
    connection.commit()
    last_id = cursor.lastrowid
    connection.close()
    return last_id


def log(actor: str, action: str, entity: str):
    ex(
        "insert into audit values(?, ?, ?, ?)",
        int(time.time()),
        actor,
        action,
        entity,
    )


def ensure_schema():
    connection = db()
    connection.execute(
        "create table if not exists prescriptions(id integer primary key, customer_id, profile_name, order_code, rx_file, approved_at, valid_until)"
    )
    for col, ddl in [
        ("consent_at", "alter table users add column consent_at integer"),
        ("token_ver", "alter table users add column token_ver integer default 1"),
        ("is_minor", "alter table profiles add column is_minor integer default 0"),
        ("guardian_consent", "alter table profiles add column guardian_consent integer default 0"),
        ("payment_ref", "alter table orders add column payment_ref text"),
        ("delivery_partner", "alter table orders add column delivery_partner text"),
        ("original_price", "alter table items add column original_price integer"),
    ]:
        try:
            connection.execute(ddl)
        except sqlite3.OperationalError:
            pass
    connection.commit()
    connection.close()
