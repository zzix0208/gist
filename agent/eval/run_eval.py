"""批量评测：固定样本跑完整 agent，算确定性指标，落 runs/*.json。
  agent/.venv/bin/python -m agent.eval.run_eval --label baseline
  agent/.venv/bin/python -m agent.eval.run_eval --label smoke --limit 1
单条样本失败只跳过该条，不炸整批。
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .. import db
from ..graph import graph
from . import metrics
from .samples import load_samples

RUNS_DIR = Path(__file__).resolve().parent / "runs"


def _truncate(raw: str, n: int = 140) -> str:
    """截断到标题+导语长度，制造信息缺口（仿 PROJECT.md 评测法），逼出搜索价值。"""
    return raw[:n]


def run_eval(
    label: str,
    limit: int | None = None,
    use_search: bool = True,
    use_reflection: bool = True,
    truncate: bool = False,
) -> None:
    samples = load_samples()
    if limit:
        samples = samples[:limit]
    existing = {c["name"] for c in db.list_concepts()}
    cfg = {
        "configurable": {"use_search": use_search, "use_reflection": use_reflection},
        "recursion_limit": 25,
    }

    rows = []
    for s in samples:
        raw = _truncate(s["raw_text"]) if truncate else s["raw_text"]
        try:
            state = graph.invoke({"title": s["title"], "raw_text": raw}, config=cfg)
        except Exception as e:
            print(f"[{s['id']}] 失败: {e!r}", flush=True)
            continue

        num = metrics.number_metrics(
            state["result"], raw, metrics.search_text_from_state(state)
        )
        con = metrics.concept_metrics(state["result"], existing)
        ref = metrics.reflection_metrics(state)
        row = {
            "id": s["id"],
            "title": s["title"],
            "steps": state.get("steps", 0),
            "search_count": state.get("search_count", 0),
            **num,
            **con,
            **ref,
        }
        rows.append(row)
        print(
            f"[{s['id']}] 搜索{row['search_count']} | 搜索可溯源{row['sourced_from_search']} "
            f"疑似编造{row['unsourced']} | 复用{row['reused']}/{row['concepts_total']} | "
            f"首检{'过' if row['first_pass'] else '挂'}"
            f"{'→回改后过' if row['revised'] and row['final_pass'] else ''}",
            flush=True,
        )

    agg = metrics.aggregate(rows)
    report = {
        "label": label,
        "config": {"use_search": use_search, "use_reflection": use_reflection, "truncate": truncate},
        "n": len(rows),
        "aggregate": agg,
        "per_sample": rows,
    }
    RUNS_DIR.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = RUNS_DIR / f"{ts}_{label}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== 聚合 ===", flush=True)
    for k, v in agg.items():
        print(f"  {k}: {v}")
    print(f"\n已写入 {path}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default="baseline")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--search", choices=["on", "off"], default="on")
    ap.add_argument("--reflection", choices=["on", "off"], default="on")
    ap.add_argument("--truncate", action="store_true")
    args = ap.parse_args()
    run_eval(
        args.label,
        args.limit,
        use_search=args.search == "on",
        use_reflection=args.reflection == "on",
        truncate=args.truncate,
    )
