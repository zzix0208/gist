"""确定性指标（可复算、不烧钱），分别对应三个 agent 模式：
  number_metrics    → 工具使用：搜索补全了多少可溯源数据点、有没有疑似编造
  concept_metrics   → RAG/记忆：输出概念有多少复用了已有库
  reflection_metrics→ 反思：首检通过率、回改前后问题数
主观质量分（LLM-judge）留到 Step 5 再加 —— 能用规则算的就不丢给 LLM。

已知局限：数字按子串精确匹配证据，四舍五入(如 32.99%→33%)会被判为"未溯源"，
是有意的保守口径；边界 case 可在 Step 5 用 judge 复核。
"""
import re

from langchain_core.messages import ToolMessage

_NUM = re.compile(r"\d+(?:[.,]\d+)?(?:%|‰|个百分点|万亿|亿|万|千|元|名|倍|个基点|bp)?")
_UNIT = re.compile(r"%|‰|个百分点|万亿|亿|万|千|元|名|倍|基点|bp")


def _is_datapoint(tok: str) -> bool:
    """过滤噪声：保留带单位/百分号、含小数、或两位数及以上的数字，丢掉孤立个位数。"""
    digits = re.sub(r"\D", "", tok)
    return bool(_UNIT.search(tok)) or ("." in tok) or len(digits) >= 2


def extract_numbers(text: str) -> list[str]:
    out, seen = [], set()
    for t in _NUM.findall(text or ""):
        if _is_datapoint(t) and t not in seen:
            seen.add(t)
            out.append(t)
    return out


def search_text_from_state(state: dict) -> str:
    """把检索阶段的工具结果拼出来，作为'搜索来源证据'。"""
    return "\n".join(m.content for m in state.get("messages", []) if isinstance(m, ToolMessage))


def number_metrics(result: dict, raw_text: str, search_text: str) -> dict:
    text = result.get("summary", "") + " " + result.get("mechanism", "")
    nums = extract_numbers(text)
    from_raw = [n for n in nums if n in raw_text]
    from_search = [n for n in nums if n not in raw_text and n in search_text]
    unsourced = [n for n in nums if n not in raw_text and n not in search_text]
    return {
        "numbers_total": len(nums),
        "sourced_from_search": len(from_search),  # 头条: 搜索补全的可溯源数据点(无搜索时应≈0)
        "sourced_total": len(from_raw) + len(from_search),
        "unsourced": len(unsourced),              # 既不在原文也不在搜索→疑似编造/越界
        "unsourced_list": unsourced,
    }


def concept_metrics(result: dict, existing_names: set) -> dict:
    out = result.get("concepts", [])
    reused = [c for c in out if c.get("name") in existing_names]
    return {
        "concepts_total": len(out),
        "reused": len(reused),
        "reuse_rate": round(len(reused) / len(out), 2) if out else 0.0,
    }


def reflection_metrics(state: dict) -> dict:
    fc = state.get("first_critique") or {}
    cc = state.get("critique") or {}
    return {
        "first_pass": bool(fc.get("passed")),
        "first_issues": len(fc.get("issues", [])),
        "revised": state.get("revise_count", 0) > 0,
        "final_pass": bool(cc.get("passed")),
    }


def aggregate(rows: list[dict]) -> dict:
    n = len(rows) or 1
    total = lambda k: sum(r.get(k, 0) for r in rows)
    return {
        "avg_sourced_from_search": round(total("sourced_from_search") / n, 2),
        "avg_unsourced": round(total("unsourced") / n, 2),
        "avg_reuse_rate": round(sum(r.get("reuse_rate", 0) for r in rows) / n, 2),
        "total_reused": total("reused"),
        "total_concepts": total("concepts_total"),
        "first_pass_rate": round(sum(1 for r in rows if r.get("first_pass")) / n, 2),
        "revised_count": sum(1 for r in rows if r.get("revised")),
        "final_pass_rate": round(sum(1 for r in rows if r.get("final_pass")) / n, 2),
    }
