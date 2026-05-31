import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type { GenerateArticleResult, Source } from './types';
import { buildArticlePrompt } from './prompts';
import { parseStructured } from './parse';
import { runSearchAgent } from './agent';

export async function generateArticle(
  title: string,
  rawText: string,
  opts?: { useSearch?: boolean; model?: string },
): Promise<{ result: GenerateArticleResult; sources: Source[] }> {
  // 搜索 Agent: DeepSeek tool-calling 自主循环, 模型自己决定搜不搜/搜什么/几次/停.
  // 与 LLM_PROVIDER 无关, 固定走 DeepSeek(需 DEEPSEEK_API_KEY + TAVILY_API_KEY).
  if (opts?.useSearch) {
    return runSearchAgent(title, rawText, opts.model);
  }

  // 无搜索路径: 单次生成. 批处理(fetch-rss)走这里, 默认用更快更省的 flash.
  // opts.model 可覆盖(对照评测时强制两组同模型)。
  const prompt = buildArticlePrompt(title, rawText);
  const provider = process.env.LLM_PROVIDER ?? 'gemini';
  const raw = provider === 'deepseek' ? await callDeepseek(prompt, opts?.model) : await callGemini(prompt);
  const result = parseStructured(raw);
  if (result.concepts.length === 0) {
    // Dump raw response only when something looks off, so we can diagnose
    // without flooding normal logs. Safe to keep in prod.
    console.warn(
      '[llm] parsed 0 concepts — possible LLM omission or bad JSON. raw response:\n>>>>>>>>>>\n' +
        raw +
        '\n<<<<<<<<<<',
    );
  }
  return { result, sources: [] };
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callDeepseek(prompt: string, model?: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });
  const res = await client.chat.completions.create({
    model: model ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return res.choices[0]?.message?.content ?? '';
}
