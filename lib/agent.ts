import 'server-only';
import OpenAI from 'openai';
import { parseStructured } from './parse';
import { searchWeb, type SearchResult } from './search';
import { buildAgentSystemPrompt, buildAgentFinalizePrompt } from './prompts';
import type { GenerateArticleResult, Source } from './types';

// 真 Agent: 把 search 当工具交给 DeepSeek, 模型在多轮循环里自己决定要不要搜、
// 搜什么、搜几次、何时停 —— 控制流在模型手里, 不是代码写死的流水线.
//
// 两阶段:
//   1) 检索阶段 — 带 tools、不带 json 格式约束, 让模型自由调 search 直到它不再
//      调工具或撞 MAX_STEPS 上限.
//   2) 定稿 — 不带 tools、带 response_format:json_object, 拿一份干净 JSON.
// 拆开既绕过 tools 与 response_format 的兼容性不确定, 也保证最终输出可解析.
//
// 契约 { result, sources } 与无搜索路径一致, 前端 ArticleView 无需区分.

const MAX_STEPS = 4; // 最多几轮工具调用, 防模型空转烧额度
const MAX_SOURCES = 8; // 入库/展示的来源上限, 避免文章页来源列表过长

export async function runSearchAgent(
  title: string,
  rawText: string,
  modelOverride?: string,
): Promise<{ result: GenerateArticleResult; sources: Source[] }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  const model = modelOverride ?? process.env.DEEPSEEK_MODEL_AGENT ?? 'deepseek-v4-pro';
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'search',
        description:
          '联网检索. 用于核对原文里的数字/事实、补背景或查最新进展. 原文已足够时不必调用. 你自己决定搜几次、搜什么.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '中文检索词, 尽量具体(带主体/时间/数字等关键词)',
            },
          },
          required: ['query'],
        },
      },
    },
  ];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildAgentSystemPrompt() },
    { role: 'user', content: `新闻标题: ${title}\n新闻原文/摘要: ${rawText}` },
  ];

  const sources: Source[] = [];
  const seen = new Set<string>();
  let searchCount = 0;

  // 检索阶段: 模型自主决定调用 search, 直到它不再调工具或撞上限.
  for (let step = 1; step <= MAX_STEPS; step++) {
    const resp = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
    });
    const msg = resp.choices[0]?.message;
    if (!msg) break;
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) break; // 模型直接给文本 → 它认为不用(再)搜了

    for (const call of calls) {
      if (call.type !== 'function' || call.function.name !== 'search') {
        messages.push({ role: 'tool', tool_call_id: call.id, content: 'unknown tool' });
        continue;
      }
      let query = '';
      try {
        query = String(JSON.parse(call.function.arguments || '{}').query ?? '').trim();
      } catch {
        query = '';
      }
      console.log(`[agent] step ${step}: search(${JSON.stringify(query)})`);

      let results: SearchResult[] = [];
      if (query) {
        try {
          results = await searchWeb(query);
          searchCount += 1;
        } catch (err) {
          console.warn(
            `[agent] search failed for "${query}":`,
            err instanceof Error ? err.message : err,
          );
        }
      }
      for (const r of results) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          sources.push({ title: r.title, url: r.url, query: query || undefined });
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: formatResults(results) });
    }
  }

  // 定稿: 不带 tools, 要求干净 JSON.
  messages.push({ role: 'user', content: buildAgentFinalizePrompt() });
  const final = await client.chat.completions.create({
    model,
    messages,
    response_format: { type: 'json_object' },
  });
  const text = final.choices[0]?.message?.content ?? '';
  const result = parseStructured(text);

  const kept = sources.slice(0, MAX_SOURCES);
  console.log(`[agent] done: ${searchCount} searches, ${sources.length} sources (kept ${kept.length})`);
  if (result.concepts.length === 0) {
    console.warn('[agent] parsed 0 concepts — raw response:\n>>>>>>>>>>\n' + text + '\n<<<<<<<<<<');
  }
  return { result, sources: kept };
}

// 把检索结果拼成喂回模型的文本(含正文摘要, 供模型判断与引用).
function formatResults(results: SearchResult[]): string {
  if (results.length === 0) return '没有检索到结果.';
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}\n来源: ${r.url}`)
    .join('\n\n');
}
