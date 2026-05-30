export type Layer = '宏观' | '产业' | '微观' | '技术';

export const LAYERS: readonly Layer[] = ['宏观', '产业', '微观', '技术'];

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
};

export type GenerateArticleResult = {
  summary: string;
  mechanism: string;
  uncertainty: string;
  concepts: Array<{ name: string; layer: Layer; definition: string }>;
};

// View shapes returned by lib/data.ts. Kept here (not in data.ts) so client
// components can import the types without pulling in the server-only module.
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
