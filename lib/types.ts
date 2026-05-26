export type Layer = '宏观' | '产业' | '微观' | '技术';

export const LAYERS: readonly Layer[] = ['宏观', '产业', '微观', '技术'];

export type Concept = {
  name: string;
  layer: Layer;
  definition: string;
  first_seen: string;
  appearances: string[];
};

export type Article = {
  id: string;
  title: string;
  source_url?: string;
  raw_text: string;
  created_at: string;
  sections: {
    mechanism: string;
    history: string;
    uncertainty: string;
  };
  concepts: Array<{ name: string; layer: Layer }>;
};

export type GenerateArticleResult = {
  mechanism: string;
  history: string;
  uncertainty: string;
  concepts: Array<{ name: string; layer: Layer; definition: string }>;
};
