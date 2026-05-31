"""工具定义。@tool 只用来给 bind_tools 生成 schema（让模型知道有这个工具、怎么调）；
真正执行在 nodes.py 的 tools 节点里手写，这样能把 sources / concept_hits 这类副作用
并进 state —— 预置的 ToolNode 只会把结果塞回 messages，拿不到结构化副作用。
"""
from langchain_core.tools import tool

from . import db, search as _search


@tool
def search(query: str) -> str:
    """联网检索. 用于核对原文里的数字/事实、补背景或查最新进展. 原文已足够时不必调用.
    你自己决定搜几次、搜什么. query 用中文, 尽量具体(带主体/时间/数字等关键词)."""
    return format_results(_search.tavily_search(query))


def format_results(results: list[dict]) -> str:
    """把检索结果拼成回灌给模型的文本（含摘要，供模型判断与引用）。"""
    if not results:
        return "没有检索到结果."
    return "\n\n".join(
        f"[{i + 1}] {r['title']}\n{r['content']}\n来源: {r['url']}"
        for i, r in enumerate(results)
    )


@tool
def concept_lookup(name: str) -> str:
    """查概念库里有没有这个术语的现成定义. 写 concepts 前先查: 命中就复用它的定义和层级,
    不要另造说法; 未收录再自己定义. name 用术语本身, 不带括号/符号."""
    return format_concept(db.get_concept(name), name)


def format_concept(c: dict | None, name: str) -> str:
    """把概念库查询结果拼成回灌给模型的文本。"""
    if not c:
        return f"概念库未收录「{name}」, 可作为新概念自行定义."
    return f"概念库已有「{c['name']}」(层: {c['layer']})\n定义: {c['definition']}"


TOOLS = [search, concept_lookup]
