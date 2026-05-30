import 'server-only';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { LAYERS, type GenerateArticleResult, type Layer } from './types';
import { buildArticlePrompt } from './prompts';

export async function generateArticle(
  title: string,
  rawText: string,
): Promise<GenerateArticleResult> {
  const prompt = buildArticlePrompt(title, rawText);
  const provider = process.env.LLM_PROVIDER ?? 'gemini';
  const markdown = provider === 'deepseek' ? await callDeepseek(prompt) : await callGemini(prompt);
  const result = parseV5Markdown(markdown);
  if (result.concepts.length === 0) {
    // Dump raw response only when something looks wrong so we have something
    // to diagnose without flooding normal logs. Safe to keep in prod.
    console.warn(
      '[llm] parsed 0 concepts — possible parser miss or LLM omission. raw response:\n>>>>>>>>>>\n' +
        markdown +
        '\n<<<<<<<<<<',
    );
  }
  return result;
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callDeepseek(prompt: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });
  const res = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0]?.message?.content ?? '';
}

function parseV5Markdown(md: string): GenerateArticleResult {
  const headerRe = /^##\s+(.+?)\s*$/gm;
  type H = { name: string; bodyStart: number; headerStart: number };
  const headers: H[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(md)) !== null) {
    headers.push({ name: m[1], headerStart: m.index, bodyStart: m.index + m[0].length });
  }
  if (headers.length === 0) throw new Error('LLM output missing ## headers');

  const sectionByKeyword = (keyword: string): string => {
    const idx = headers.findIndex((h) => h.name.includes(keyword));
    if (idx === -1) throw new Error(`LLM output missing section: ${keyword}`);
    const end = idx + 1 < headers.length ? headers[idx + 1].headerStart : md.length;
    return md.slice(headers[idx].bodyStart, end).trim();
  };

  const mechanism = sectionByKeyword('机制');
  const history = sectionByKeyword('历史');
  const uncertainty = sectionByKeyword('不确定');
  const conceptsBody = sectionByKeyword('概念');

  return {
    mechanism,
    history,
    uncertainty,
    concepts: parseConceptsBlock(conceptsBody),
  };
}

function parseConceptsBlock(
  text: string,
): Array<{ name: string; layer: Layer; definition: string }> {
  const lines = text
    .split('\n')
    .map(stripBulletAndBold)
    .filter((l) => l.length > 0);

  const entries: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    // a new concept starts on a line that is bracketed OR carries a (层) tag
    if (/^[\[【]/.test(line) || /[(（]\s*(宏观|产业|微观|技术)\s*[)）]/.test(line)) {
      if (current.length) entries.push(current.join(' '));
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) entries.push(current.join(' '));

  // Accept both bracketed "[名] (层) - 定义" and bare/bold "名 (层) - 定义"
  // (the model often drops the [] and uses **bold** instead). Brackets optional.
  const entryRe =
    /^[\[【]?\s*([^\]】(（]+?)\s*[\]】]?\s*[(（]\s*([^)）]*?)\s*[)）]\s*[-—–:：]\s*(.+)$/;
  const out: Array<{ name: string; layer: Layer; definition: string }> = [];
  for (const entry of entries) {
    const match = entryRe.exec(entry);
    if (!match) continue;
    const name = match[1].trim();
    const layer = pickLayer(match[2]);
    let definition = match[3].trim();
    definition = definition.replace(/\s*[(（][^()（）]*[)）]\s*$/, '');
    definition = definition.replace(/[。.\s]+$/, '');
    out.push({ name, layer, definition });
  }
  return out;
}

function stripBulletAndBold(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[*\-•·]\s+/, '');
  s = s.replace(/\*\*/g, '');
  return s.trim();
}

function pickLayer(raw: string): Layer {
  for (const l of LAYERS) {
    if (raw.includes(l)) return l;
  }
  console.warn(`[llm] unknown layer "${raw.trim()}", defaulting to 技术`);
  return '技术';
}
