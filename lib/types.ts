export type Layer = 'Macro' | 'Industry' | 'Micro' | 'Technical';

export const LAYERS: readonly Layer[] = ['Macro', 'Industry', 'Micro', 'Technical'];

export type Article = {
  id: string;
  title: string;
  source_url?: string;
  raw_text: string;
  created_at: string;
  sections: {
    summary: string;
    mechanism: string;
    uncertainty: string;
  };
  concepts: Array<{ name: string; layer: Layer }>;
  sources?: Source[];
};

export type GenerateArticleResult = {
  summary: string;
  mechanism: string;
  uncertainty: string;
  concepts: Array<{ name: string; layer: Layer; definition: string }>;
};

// A source the fact-check agent actually retrieved while grounding the answer.
// Lives here (no 'server-only') so the client ArticleView can import the type.
export type Source = {
  title: string;
  url: string;
  query?: string;
};

// View shapes returned by lib/data.ts. Kept here (not in data.ts) so client
// components can import the types without pulling in the server-only module.
export type ArticleListItem = {
  id: string;
  title: string;
  summary: string;
  source_url?: string;
  created_at: string;
};

export type ConceptListItem = {
  name: string;
  layer: Layer;
  firstSeen: string;
  appearanceCount: number;
};

export type ConceptDetail = {
  name: string;
  layer: Layer;
  definition: string;
  firstSeen: string;
  appearances: Array<{ id: string; title: string; createdAt: string }>;
};
