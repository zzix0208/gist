"""DeepSeek 走 OpenAI 兼容端点，包成 LangChain chat model，便于 LangGraph 节点
bind_tools。flash 快/省、pro 贵/好，按节点重要性分配（见计划"成本"段）。
"""
from langchain_openai import ChatOpenAI

from .config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, MODEL_FLASH, MODEL_PRO


def make_llm(model: str | None = None, **kwargs) -> ChatOpenAI:
    return ChatOpenAI(
        model=model or MODEL_FLASH,
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        temperature=kwargs.pop("temperature", 0),  # 评测要可复现，默认 0
        **kwargs,
    )


__all__ = ["make_llm", "MODEL_FLASH", "MODEL_PRO"]
