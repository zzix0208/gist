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
  const raw = provider === 'deepseek' ? await callDeepseek(prompt) : await callGemini(prompt);
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
  return result;
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

async function callDeepseek(prompt: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.deepseek.com' });
  const res = await client.chat.completions.create({
    model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  return res.choices[0]?.message?.content ?? '';
}

// The model is asked to return a JSON object. Parse it tolerantly and normalize
// every field, so a small wobble in the response can't crash the route or
// surface garbage. Concept names arrive clean from JSON — no symbol-stripping.
function parseStructured(raw: string): GenerateArticleResult {
  const obj = extractJson(raw);
  const concepts = Array.isArray(obj.concepts)
    ? obj.concepts
        .map((c: unknown) => {
          const o = (c ?? {}) as Record<string, unknown>;
          return {
            name: String(o.name ?? '').trim(),
            layer: pickLayer(String(o.layer ?? '')),
            definition: String(o.definition ?? '').trim(),
          };
        })
        .filter((c) => c.name.length > 0)
    : [];
  return {
    summary: String(obj.summary ?? '').trim(),
    mechanism: String(obj.mechanism ?? '').trim(),
    uncertainty: String(obj.uncertainty ?? '').trim(),
    concepts,
  };
}

// Tolerant: strip a ```json fence if present, else slice the outermost { ... }.
function extractJson(raw: string): Record<string, unknown> {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith('{')) {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a !== -1 && b > a) s = s.slice(a, b + 1);
  }
  return JSON.parse(s) as Record<string, unknown>;
}

function pickLayer(raw: string): Layer {
  for (const l of LAYERS) {
    if (raw.includes(l)) return l;
  }
  console.warn(`[llm] unknown layer "${raw.trim()}", defaulting to 技术`);
  return '技术';
}
