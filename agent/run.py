"""CLI 入口：跑单篇、打印解读 + agent 行为。
  agent/.venv/bin/python -m agent.run --sample 5
  agent/.venv/bin/python -m agent.run --title "..." --text "..."
"""
import argparse

from . import db
from .eval.samples import get_sample
from .graph import graph


def _summarize(node: str, upd: dict) -> str:
    """把单个节点的状态更新压成一行人话，给 --trace 用。"""
    if node == "prepare":
        return "种入 system + user 消息"
    if node == "agent":
        msgs = upd.get("messages") or []
        ai = msgs[-1] if msgs else None
        tcs = getattr(ai, "tool_calls", None) or []
        if tcs:
            return "决定调工具 → " + ", ".join(f"{c['name']}{c.get('args') or {}}" for c in tcs)
        return "不再调工具 → 去定稿"
    if node == "tools":
        return (
            f"执行工具，累计来源 {len(upd.get('sources', []))}、"
            f"命中概念 {len(upd.get('concept_hits', []))}、搜索 {upd.get('search_count', 0)} 次"
        )
    if node == "draft":
        r = upd.get("result") or {}
        return f"出稿：concepts {len(r.get('concepts', []))} 个"
    if node == "critic":
        c = upd.get("critique") or {}
        return "自检：通过" if c.get("passed") else f"自检：不通过，{len(c.get('issues', []))} 个问题"
    if node == "revise":
        return "按问题回改一版"
    return str(upd)[:60]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, help="news-samples.md 里的编号 1-6")
    ap.add_argument("--text", type=str, help="直接传原文")
    ap.add_argument("--title", type=str, default="(无标题)")
    ap.add_argument("--trace", action="store_true", help="逐节点打印执行轨迹（可观测）")
    args = ap.parse_args()

    if args.sample:
        s = get_sample(args.sample)
        title, raw = s["title"], s["raw_text"]
    elif args.text:
        title, raw = args.title, args.text
    else:
        raise SystemExit("需要 --sample N 或 --text ...")

    print(f"=== 输入: {title} ===")
    cfg = {"recursion_limit": 25}
    if args.trace:
        print("--- trace（逐节点执行）---")
        state = {"title": title, "raw_text": raw}
        for chunk in graph.stream({"title": title, "raw_text": raw}, config=cfg, stream_mode="updates"):
            for node, upd in chunk.items():
                print(f"  → {node}: {_summarize(node, upd)}")
                state.update(upd)  # 节点返回全量(messages 除外)，update 即累积出最终态
    else:
        state = graph.invoke({"title": title, "raw_text": raw}, config=cfg)

    r = state["result"]
    print("\n--- 解读 ---")
    print("summary:", r["summary"])
    print("mechanism:", r["mechanism"])
    print("uncertainty:", r["uncertainty"])
    print("concepts:")
    for c in r["concepts"]:
        print(f"  - {c['name']} ({c['layer']}): {c['definition']}")

    print("\n--- agent 行为 ---")
    print(f"工具轮数 steps: {state.get('steps', 0)}")
    print(f"搜索次数 search_count: {state.get('search_count', 0)}")
    sources = state.get("sources", [])
    print(f"来源数: {len(sources)}")
    for src in sources:
        print(f"  - [{src.get('query', '')}] {src['title']} {src['url']}")

    hits = state.get("concept_hits", [])
    existing = {c["name"] for c in db.list_concepts()}
    out = r["concepts"]
    reused = sum(1 for c in out if c["name"] in existing)
    print("\n--- RAG / 概念复用 ---")
    print(f"concept_lookup 命中已有概念: {len(hits)} 次")
    print(f"输出概念 {len(out)} 个: 复用已有 {reused}, 新建 {len(out) - reused}")
    for c in out:
        tag = "复用" if c["name"] in existing else "新建"
        print(f"  [{tag}] {c['name']} ({c['layer']})")

    fc = state.get("first_critique") or {}
    cc = state.get("critique") or {}
    print("\n--- Reflection / 自检 ---")
    print(f"首检: {'通过' if fc.get('passed') else '不通过'}，问题 {len(fc.get('issues', []))} 个")
    for it in fc.get("issues", []):
        print(f"  - [{it.get('rule')}|{it.get('severity')}] {it.get('detail')}")
    rc = state.get("revise_count", 0)
    print(f"回改次数: {rc}")
    if rc:
        print(f"回改后: {'通过' if cc.get('passed') else '仍不通过'}，问题 {len(cc.get('issues', []))} 个")


if __name__ == "__main__":
    main()
