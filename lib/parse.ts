import { LAYERS, type GenerateArticleResult, type Layer } from './types';

// Shared, dependency-free parsing for the LLM's JSON output. Lives in its own
// module so both lib/llm.ts (single-shot) and lib/agent.ts (grounded) can reuse
// it without importing each other (avoids a circular dependency).

// The model is asked to return a JSON object. Parse it tolerantly and normalize
// every field, so a small wobble in the response can't crash the route or
// surface garbage. Concept names arrive clean from JSON — no symbol-stripping.
export function parseStructured(raw: string): GenerateArticleResult {
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
// Grounding responses often wrap the JSON in prose, so the slice matters.
export function extractJson(raw: string): Record<string, unknown> {
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
  console.warn(`[parse] unknown layer "${raw.trim()}", defaulting to 技术`);
  return '技术';
}
