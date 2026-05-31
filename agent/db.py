"""只读访问生产概念库（Supabase Postgres）。

设计上只暴露 SELECT，没有任何写入路径 —— 从代码层面杜绝污染 Next.js app 正在用的
真实数据，也保证评测的"已有概念基线"在多次 run 之间稳定可比。
"""
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg

from .config import DATABASE_URL

_conn: psycopg.Connection | None = None


def _sanitize(url: str) -> str:
    """DATABASE_URL 是给 Prisma 用的 pooled 串，带 libpq 不认识的查询参数
    （pgbouncer / connection_limit 等），直接传给 psycopg 会报错。这里只保留
    libpq 认识的参数，并强制 sslmode=require（Supabase 需要 SSL）。"""
    parts = urlsplit(url)
    allowed = {"sslmode", "connect_timeout", "application_name", "options"}
    q = dict((k, v) for k, v in parse_qsl(parts.query) if k in allowed)
    q.setdefault("sslmode", "require")
    q.setdefault("connect_timeout", "10")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


def _connection() -> psycopg.Connection:
    """模块级单连接，避免每次查询重连。psycopg3 默认不缓存 prepared statement，
    所以在 pgbouncer transaction 模式下是安全的。"""
    global _conn
    if _conn is None or _conn.closed:
        _conn = psycopg.connect(_sanitize(DATABASE_URL))
    return _conn


def _query(sql: str, params: tuple = (), one: bool = False):
    """跑只读查询；Supabase pooler 中途断开空闲连接时，重连重试一次。
    长时间批量评测里连接会被 pooler 回收，这道重连让单条样本不至于因此失败。"""
    global _conn
    for attempt in (1, 2):
        try:
            with _connection().cursor() as cur:
                cur.execute(sql, params)
                return cur.fetchone() if one else cur.fetchall()
        except psycopg.OperationalError:
            try:
                if _conn and not _conn.closed:
                    _conn.close()
            except Exception:
                pass
            _conn = None  # 强制下次重连
            if attempt == 2:
                raise
    return None


def count_concepts() -> int:
    return _query("SELECT count(*) FROM concepts", one=True)[0]


def get_concept(name: str) -> dict | None:
    """精确查名（等价 lib/data.ts 的 getConcept）。命中返回 dict，否则 None。"""
    row = _query(
        "SELECT name, layer, definition, first_seen FROM concepts WHERE name = %s",
        (name,),
        one=True,
    )
    if not row:
        return None
    return {"name": row[0], "layer": row[1], "definition": row[2], "first_seen": row[3]}


def list_concepts() -> list[dict]:
    """列全库概念名 + 层（等价 listConcepts）。用于注入 system prompt。"""
    rows = _query("SELECT name, layer FROM concepts ORDER BY first_seen")
    return [{"name": r[0], "layer": r[1]} for r in rows]
