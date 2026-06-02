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
//
// 这条链路是同步的、卡在 serverless 函数超时里(见 generate-article route 的
// maxDuration). 三件事保证它跑得进 60s 上限:
//   - 默认走 flash(实测定稿 ~5.5s, 而 pro ~23s);
//   - MAX_STEPS=1 + 整体时间预算 DEADLINE_MS, 到点强制停止检索去定稿;
//   - 每次模型调用都带硬超时, 且检索失败不致命(降级为直接定稿).

const MAX_STEPS = 1; // 最多几轮工具调用; 1 轮(决策→搜→定稿)对财经速读已够, 提速 + 防空转
const MAX_SOURCES = 8; // 入库/展示的来源上限, 避免文章页来源列表过长

// 时间预算: 函数 maxDuration=60s, 留 ~10s 余量(网络 + 入库)给 DEADLINE 之外.
const DEADLINE_MS = 50_000; // 整条 agent 的软上限
const FINALIZE_RESERVE_MS = 15_000; // 给定稿预留, 检索到点就停
const MAX_CALL_MS = 30_000; // 单次模型调用硬超时上限

export async function runSearchAgent(
  title: string,
  rawText: string,
  modelOverride?: string,
): Promise<{ result: GenerateArticleResult; sources: Source[] }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  // 默认 flash: pro 是推理模型, 每次调用都慢(实测定稿 ~23s), 串行多轮会撞函数超时.
  const model =
    modelOverride ?? process.env.DEEPSEEK_MODEL_AGENT ?? process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash';
  // maxRetries:0 — 卡超时的同步路径里, 默认重试会把时间预算翻倍(最坏 30s→60s), 关掉.
  const client = new OpenAI({
    apiKey: key,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
    maxRetries: 0,
  });
  const start = Date.now();

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

  // 检索阶段: 模型自主决定调用 search, 直到它不再调工具、撞步数上限或时间预算到点.
  for (let step = 1; step <= MAX_STEPS; step++) {
    const elapsed = Date.now() - start;
    if (elapsed > DEADLINE_MS - FINALIZE_RESERVE_MS) {
      console.log(`[agent] step ${step}: budget reached (${elapsed}ms), stop retrieval, finalize`);
      break;
    }
    // 单次硬超时: 不超过给检索剩下的时间, 也不超过 MAX_CALL_MS.
    const callTimeout = Math.min(MAX_CALL_MS, Math.max(5_000, DEADLINE_MS - FINALIZE_RESERVE_MS - elapsed));
    let resp;
    try {
      resp = await client.chat.completions.create(
        { model, messages, tools, tool_choice: 'auto' },
        { timeout: callTimeout },
      );
    } catch (err) {
      // 检索阶段失败不致命: 记日志, 用已检索到的资料直接去定稿.
      console.warn(`[agent] step ${step} call failed, finalize with what we have:`, err instanceof Error ? err.message : err);
      break;
    }
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

  // 定稿: 不带 tools, 要求干净 JSON. 超时取剩余预算(至少 8s), 保证不超过 DEADLINE.
  messages.push({ role: 'user', content: buildAgentFinalizePrompt() });
  const finalizeTimeout = Math.max(8_000, DEADLINE_MS - (Date.now() - start));
  const final = await client.chat.completions.create(
    { model, messages, response_format: { type: 'json_object' } },
    { timeout: finalizeTimeout },
  );
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
