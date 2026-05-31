"""集中读取配置。

Next.js 把密钥拆在两个文件里（见 PROJECT.md 安全段）：
  .env       — 数据库连接串 DATABASE_URL / DIRECT_URL
  .env.local — LLM 密钥 DEEPSEEK_API_KEY / TAVILY_API_KEY / 模型名 / LLM_PROVIDER
所以这里两个都读，复用同一套密钥，不另存一份。
"""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent  # 仓库根目录
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local")

# 数据库（Supabase Postgres，pooled 串）
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# DeepSeek（OpenAI 兼容端点）
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL_FLASH = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash")  # 快/省
MODEL_PRO = os.environ.get("DEEPSEEK_MODEL_AGENT", "deepseek-v4-pro")  # 贵/好

# Tavily 联网检索
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
