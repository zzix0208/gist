"""解析 news-samples.md → 固定评测集（只读，不改原文件）。

格式：每条以 `## [N] 分类 - 标题` 起，`### 原文` 段到 `---` 之间是正文；
开头介绍段和结尾 `## 修订说明` 没有 `[N]`，自动跳过。
"""
import re
from pathlib import Path

SAMPLES_PATH = Path(__file__).resolve().parent.parent.parent / "news-samples.md"

_HEADER = re.compile(r"##\s*\[(\d+)\]\s*(.+?)\s*-\s*(.+)")
_BODY = re.compile(r"###\s*原文\s*(.+?)(?:\n---|\Z)", re.S)


def load_samples() -> list[dict]:
    text = SAMPLES_PATH.read_text(encoding="utf-8")
    samples = []
    for block in re.split(r"\n(?=## )", text):
        h = _HEADER.match(block.strip())
        if not h:
            continue  # 跳过介绍段 / 修订说明
        body = _BODY.search(block)
        samples.append(
            {
                "id": int(h.group(1)),
                "category": h.group(2).strip(),
                "title": h.group(3).strip(),
                "raw_text": body.group(1).strip() if body else "",
            }
        )
    return samples


def get_sample(sid: int) -> dict:
    for s in load_samples():
        if s["id"] == sid:
            return s
    raise ValueError(f"news-samples.md 里没有编号 {sid} 的样本")
