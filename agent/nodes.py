"""图的节点 + 路由函数。

两阶段（迁自 lib/agent.ts）落成节点：
  检索阶段 = agent ⇄ tools 循环（带 tools，不约束输出格式，模型自由调工具）
  定稿阶段 = draft（不带 tools，response_format=json_object，出干净 JSON）

循环上限放在 tools→agent 这条边（after_tools）上：模型发起的工具调用总会先在 tools
节点执行掉，再判断要不要回 agent，所以不会留下没有 ToolMessage 的悬空 tool_call。
"""
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.runnables import RunnableConfig

from . import db as _db, search as _search
from .llm import MODEL_FLASH, MODEL_PRO, make_llm
from .parse import parse_critique, parse_structured
from .prompts import (
    CRITIC_SYSTEM,
    FINALIZE_PROMPT,
    REVISE_SYSTEM,
    build_critic_prompt,
    build_revise_prompt,
    build_system_prompt,
)
from .tools import TOOLS, concept_lookup, format_concept, format_results

MAX_STEPS = 4  # agent⇄tools 最多循环几轮，防模型空转烧额度
MAX_REVISE = 1  # 自检不过最多回改几次，控成本

# agent 决策节点先用 flash（多轮、省钱）；draft 定稿用 pro（质量直接进指标）。
_agent_llm = make_llm(MODEL_FLASH).bind_tools(TOOLS)                       # search + concept_lookup
_agent_llm_nosearch = make_llm(MODEL_FLASH).bind_tools([concept_lookup])   # 对照实验: 只留 RAG, 隔离搜索
_draft_llm = make_llm(MODEL_PRO).bind(response_format={"type": "json_object"})
_critic_llm = make_llm(MODEL_PRO).bind(response_format={"type": "json_object"})   # 审稿要准 → pro
_revise_llm = make_llm(MODEL_FLASH).bind(response_format={"type": "json_object"})  # 照意见改 → flash
# 普通模式兜底：DeepSeek 的 json_object 模式在某些输入上偶发空响应，退回普通模式 + 容错解析。
_draft_llm_plain = make_llm(MODEL_PRO)
_critic_llm_plain = make_llm(MODEL_PRO)
_revise_llm_plain = make_llm(MODEL_FLASH)


def _invoke_json(llm, messages, label: str = "", fallback=None) -> str:
    """调用要 JSON 的模型；空响应时重试，仍空则退回普通模式 fallback（容错解析兜底）。"""
    for attempt in (1, 2):
        resp = llm.invoke(messages)
        content = (resp.content or "").strip()
        if content:
            return content
        fr = resp.response_metadata.get("finish_reason")
        print(f"[{label}] 空响应(finish={fr})，重试 {attempt}", flush=True)
    if fallback is not None:
        content = (fallback.invoke(messages).content or "").strip()
        if content:
            print(f"[{label}] 普通模式兜底成功", flush=True)
            return content
    return ""


def prepare_node(state: dict, config: RunnableConfig) -> dict:
    """种下 system + user 两条消息，作为检索阶段对话起点；初始化计数。
    入口只需传 {title, raw_text}，Studio 里也好填。"""
    use_search = (config.get("configurable") or {}).get("use_search", True)
    user = f"新闻标题: {state['title']}\n新闻原文/摘要: {state['raw_text']}"
    system = build_system_prompt(_db.list_concepts(), use_search)  # 注入概念清单 = RAG 检索
    return {
        "messages": [SystemMessage(system), HumanMessage(user)],
        "sources": [],
        "concept_hits": [],
        "steps": 0,
        "search_count": 0,
    }


def agent_node(state: dict, config: RunnableConfig) -> dict:
    """检索决策：带 tools 调一次模型。模型自己决定调不调工具、调哪个、调几个。
    use_search=False 时只给 concept_lookup（对照实验隔离搜索这一个变量）。"""
    use_search = (config.get("configurable") or {}).get("use_search", True)
    llm = _agent_llm if use_search else _agent_llm_nosearch
    return {"messages": [llm.invoke(state["messages"])]}


def tools_node(state: dict, config: RunnableConfig) -> dict:
    """执行模型发起的工具调用，结果回灌为 ToolMessage，并收集副作用（来源、去重）。"""
    use_search = (config.get("configurable") or {}).get("use_search", True)
    last = state["messages"][-1]
    tool_messages = []
    sources = list(state.get("sources", []))
    seen = {s["url"] for s in sources}
    concept_hits = list(state.get("concept_hits", []))
    search_count = state.get("search_count", 0)

    for call in last.tool_calls:
        name = call["name"]
        args = call["args"] if isinstance(call["args"], dict) else {}
        if name == "search" and use_search:
            query = str(args.get("query", "")).strip()
            results = _search.tavily_search(query) if query else []
            if query:
                search_count += 1
            for r in results:
                if r["url"] and r["url"] not in seen:
                    seen.add(r["url"])
                    sources.append({"title": r["title"], "url": r["url"], "query": query})
            content = format_results(results)
        elif name == "concept_lookup":
            cname = str(args.get("name", "")).strip()
            c = _db.get_concept(cname) if cname else None
            if c:
                concept_hits.append(c)  # 命中已有概念 → 记一笔, 算复用率
            content = format_concept(c, cname)
        else:
            # 搜索关闭时拒绝 search 调用（兜底，与"提示里不提 search"双保险）
            content = "search 工具当前不可用." if name == "search" else "unknown tool"
        tool_messages.append(ToolMessage(content=content, tool_call_id=call["id"]))

    return {
        "messages": tool_messages,
        "sources": sources,
        "concept_hits": concept_hits,
        "search_count": search_count,
        "steps": state.get("steps", 0) + 1,
    }


def draft_node(state: dict) -> dict:
    """定稿：追加 finalize 指令，不带 tools、要 json_object，解析成结构化 result。"""
    messages = state["messages"] + [HumanMessage(FINALIZE_PROMPT)]
    content = _invoke_json(_draft_llm, messages, "draft", fallback=_draft_llm_plain)
    return {"result": parse_structured(content)}


def _search_context(state: dict) -> str:
    """把检索阶段的工具结果拼出来，供 critic/revise 核对数字来源。"""
    chunks = [m.content for m in state["messages"] if isinstance(m, ToolMessage)]
    return "\n\n".join(chunks) if chunks else "(无检索)"


def critic_node(state: dict) -> dict:
    """自检：按规则审 draft 出的 result，产出结构化 {passed, issues}。首检结果另存一份给评测。"""
    user = build_critic_prompt(state["raw_text"], _search_context(state), state["result"])
    content = _invoke_json(
        _critic_llm, [SystemMessage(CRITIC_SYSTEM), HumanMessage(user)], "critic", fallback=_critic_llm_plain
    )
    critique = parse_critique(content)
    out = {"critique": critique}
    if state.get("first_critique") is None:
        out["first_critique"] = critique
    return out


def revise_node(state: dict) -> dict:
    """回改：拿 issues 重出一版 result，回改次数 +1。"""
    user = build_revise_prompt(
        state["raw_text"], _search_context(state), state["result"], state["critique"]["issues"]
    )
    content = _invoke_json(
        _revise_llm, [SystemMessage(REVISE_SYSTEM), HumanMessage(user)], "revise", fallback=_revise_llm_plain
    )
    return {
        "result": parse_structured(content),
        "revise_count": state.get("revise_count", 0) + 1,
    }


# ── 路由（条件边）─────────────────────────────────────────────
def after_agent(state: dict) -> str:
    """agent 之后：有 tool_calls 就去执行（总会执行掉），否则直接定稿。"""
    last = state["messages"][-1]
    return "tools" if getattr(last, "tool_calls", None) else "draft"


def after_tools(state: dict) -> str:
    """tools 之后：没撞轮数上限就回 agent 再想，否则收尾定稿。"""
    return "agent" if state.get("steps", 0) < MAX_STEPS else "draft"


def after_critic(state: dict) -> str:
    """自检之后：不过关且没到回改上限就回改，否则收尾。"""
    crit = state.get("critique") or {}
    if not crit.get("passed", True) and state.get("revise_count", 0) < MAX_REVISE:
        return "revise"
    return "end"


def after_draft(state: dict, config: RunnableConfig) -> str:
    """draft 之后：开反思就去 critic 自检，关反思就直接收尾（对照实验）。"""
    use_reflection = (config.get("configurable") or {}).get("use_reflection", True)
    return "critic" if use_reflection else "end"
