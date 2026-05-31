"""装配图：把节点和条件边连起来，编译成可执行的 graph。

   START → prepare → agent ─(有 tool_calls)→ tools ─(steps<MAX)→ agent   工具循环
                       │ └─(无 tool_calls)──→ draft        └─(撞上限)→ draft
                       draft → END

控制流（搜不搜、搜几次）由模型在条件边上决定；边界和上限由这张图声明式画死。
"""
from langgraph.graph import END, START, StateGraph

from .nodes import (
    after_agent,
    after_critic,
    after_draft,
    after_tools,
    agent_node,
    critic_node,
    draft_node,
    prepare_node,
    revise_node,
    tools_node,
)
from .state import AgentState


def build_graph():
    g = StateGraph(AgentState)
    g.add_node("prepare", prepare_node)
    g.add_node("agent", agent_node)
    g.add_node("tools", tools_node)
    g.add_node("draft", draft_node)
    g.add_node("critic", critic_node)
    g.add_node("revise", revise_node)

    g.add_edge(START, "prepare")
    g.add_edge("prepare", "agent")
    g.add_conditional_edges("agent", after_agent, {"tools": "tools", "draft": "draft"})
    g.add_conditional_edges("tools", after_tools, {"agent": "agent", "draft": "draft"})
    g.add_conditional_edges("draft", after_draft, {"critic": "critic", "end": END})
    g.add_conditional_edges("critic", after_critic, {"revise": "revise", "end": END})
    g.add_edge("revise", "critic")

    return g.compile()


# 模块级单例，供 run.py 和 LangGraph Studio（langgraph.json）引用。
graph = build_graph()
