"""LangGraph 的共享状态。

控制流在模型手里，但"流过的数据"在这张 state 上显式累积：
- messages 用 add_messages reducer 累加（承载多轮 tool-calling 上下文，等价 TS 里手动 push）。
- sources / concept_hits 是工具的副作用，在 tools 节点里读旧值 + 去重后并回写。
- steps / search_count 是循环计数，给条件边判上限、给评测出指标。
"""
from typing import Annotated, Optional

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class AgentState(TypedDict):
    title: str
    raw_text: str

    messages: Annotated[list[AnyMessage], add_messages]

    sources: list[dict]        # [{title, url, query}] 检索到的来源
    concept_hits: list[dict]   # Step 2 用：命中的已有概念
    result: Optional[dict]     # 定稿产物 {summary, mechanism, uncertainty, concepts}
    critique: Optional[dict]       # 最近一次自检 {passed, issues}
    first_critique: Optional[dict] # 首次自检(回改前), 给评测算"首检通过率"
    revise_count: int          # 已回改几次（反思上限）

    steps: int                 # agent⇄tools 已循环几轮（循环上限）
    search_count: int          # 实际调用 Tavily 几次（评测指标）
