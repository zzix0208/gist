"""容错解析模型的 JSON 输出，迁自 lib/parse.ts。

模型偶尔在 JSON 外裹话或加代码块，这里宽松解析并归一化每个字段，免得一点抖动就
让整条流程崩或冒出垃圾。概念 name 从 JSON 来本就干净，不做符号清洗。
"""
import json
import re

LAYERS = ["宏观", "产业", "微观", "技术"]


def extract_json(raw: str) -> dict:
    """剥掉 ```json 代码块；否则切最外层的 {...}（检索版常在 JSON 外裹散文）。"""
    s = raw.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", s, re.IGNORECASE)
    if m:
        s = m.group(1).strip()
    if not s.startswith("{"):
        a = s.find("{")
        b = s.rfind("}")
        if a != -1 and b > a:
            s = s[a : b + 1]
    return json.loads(s)


def pick_layer(raw: str) -> str:
    """layer 容错：只要包含四层之一就归一；都不含则默认 技术。"""
    for layer in LAYERS:
        if layer in raw:
            return layer
    return "技术"


def parse_structured(raw: str) -> dict:
    try:
        obj = extract_json(raw)
    except Exception:
        obj = {}  # 空/坏响应不崩流程，返回空结构, 交由 critic/评测发现
    if not isinstance(obj, dict):
        obj = {}  # 模型偶尔把整个响应返回成 JSON 数组/标量, 也按空处理
    concepts = []
    if isinstance(obj.get("concepts"), list):
        for c in obj["concepts"]:
            o = c or {}
            name = str(o.get("name", "")).strip()
            if not name:
                continue
            concepts.append(
                {
                    "name": name,
                    "layer": pick_layer(str(o.get("layer", ""))),
                    "definition": str(o.get("definition", "")).strip(),
                }
            )
    return {
        "summary": str(obj.get("summary", "")).strip(),
        "mechanism": str(obj.get("mechanism", "")).strip(),
        "uncertainty": str(obj.get("uncertainty", "")).strip(),
        "concepts": concepts,
    }


def parse_critique(raw: str) -> dict:
    """解析自检结果。解析失败时保守放行(passed=True)不阻塞流程；
    有 issues 却 passed=True 时以 issues 为准判不过(保守一致性)。"""
    try:
        obj = extract_json(raw)
    except Exception:
        return {"passed": True, "issues": []}
    if not isinstance(obj, dict):
        return {"passed": True, "issues": []}
    issues = []
    if isinstance(obj.get("issues"), list):
        for it in obj["issues"]:
            o = it if isinstance(it, dict) else {"detail": str(it)}  # 模型有时把 issue 写成纯字符串
            issues.append(
                {
                    "rule": str(o.get("rule", "")).strip(),
                    "severity": str(o.get("severity", "")).strip(),
                    "detail": str(o.get("detail", "")).strip(),
                    "fix_hint": str(o.get("fix_hint", "")).strip(),
                }
            )
    passed = bool(obj.get("passed", len(issues) == 0))
    if issues and passed:
        passed = False
    return {"passed": passed, "issues": issues}
