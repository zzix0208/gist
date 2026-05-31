"""Tavily 联网检索。参数照抄 lib/search.ts —— 中文查询必须 topic='general' +
country='china'；topic='news' 实测返回无关英文结果。手写请求体，不用社区封装，
行为与 TS 版完全一致、最可控。
"""
import requests

from .config import TAVILY_API_KEY

TAVILY_URL = "https://api.tavily.com/search"


def tavily_search(query: str, max_results: int = 5) -> list[dict]:
    """返回 [{title, url, content}]，content 是 Tavily 抽的摘要，回灌给模型当上下文。"""
    resp = requests.post(
        TAVILY_URL,
        headers={"Authorization": f"Bearer {TAVILY_API_KEY}"},
        json={
            "query": query,
            "topic": "general",
            "country": "china",
            "search_depth": "basic",
            "max_results": max_results,
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("results") or []
    out = []
    for r in results:
        url = (r.get("url") or "").strip()
        if not url:
            continue
        out.append(
            {
                "title": (r.get("title") or "").strip(),
                "url": url,
                "content": (r.get("content") or "").strip(),
            }
        )
    return out
