"""Step 0 连通性自检：DeepSeek + Supabase 概念库 + Tavily 三个外部依赖各跑一次。
跑法（仓库根目录下）：agent/.venv/bin/python -m agent.check_env
"""
from . import db, search
from .llm import make_llm


def main() -> None:
    print("=== finews agent 连通性自检 ===")

    # 1. Supabase 概念库（只读）
    try:
        n = db.count_concepts()
        print(f"[OK]   Supabase concepts 表: {n} 条概念")
    except Exception as e:
        print(f"[FAIL] Supabase: {e!r}")

    # 2. DeepSeek（OpenAI 兼容端点）
    try:
        llm = make_llm()
        out = llm.invoke("只回一个字：好")
        print(f"[OK]   DeepSeek ({llm.model_name}): {out.content!r}")
    except Exception as e:
        print(f"[FAIL] DeepSeek: {e!r}")

    # 3. Tavily（中文检索）
    try:
        res = search.tavily_search("央行 降准", max_results=2)
        first = res[0]["title"] if res else "(空)"
        print(f"[OK]   Tavily: 返回 {len(res)} 条，首条: {first}")
    except Exception as e:
        print(f"[FAIL] Tavily: {e!r}")


if __name__ == "__main__":
    main()
