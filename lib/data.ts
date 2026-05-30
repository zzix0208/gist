import 'server-only';
import { db } from './db';
import type { Article, Layer, ConceptListItem, ConceptDetail } from './types';

// Server-side data layer (Prisma). All article/concept reads and writes go here.
// createArticleWithConcepts is the reuse boundary: the API route uses it today,
// and the future headless RSS cron will import it directly.

type NewConcept = { name: string; layer: Layer; definition: string; role?: string };

export async function createArticleWithConcepts(input: {
  title: string;
  rawText: string;
  sourceUrl?: string;
  sections: { mechanism: string; history: string; uncertainty: string };
  concepts: NewConcept[];
}): Promise<{ id: string }> {
  // De-dupe by name: the LLM can emit the same concept twice, which would
  // violate the article_concepts composite PK. Keep the first occurrence.
  const seen = new Set<string>();
  const concepts = input.concepts.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  const created = await db.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        title: input.title,
        rawText: input.rawText,
        sourceUrl: input.sourceUrl,
        mechanism: input.sections.mechanism,
        history: input.sections.history,
        uncertainty: input.sections.uncertainty,
      },
    });

    if (concepts.length > 0) {
      // skipDuplicates = "first definition wins": existing concepts keep their
      // original definition/layer/first_seen; only brand-new names get inserted.
      await tx.concept.createMany({
        data: concepts.map((c) => ({
          name: c.name,
          layer: c.layer,
          definition: c.definition,
        })),
        skipDuplicates: true,
      });
      await tx.articleConcept.createMany({
        data: concepts.map((c) => ({
          articleId: article.id,
          conceptName: c.name,
          role: c.role,
        })),
        skipDuplicates: true,
      });
    }

    return article;
  });

  return { id: created.id };
}

export async function getArticle(id: string): Promise<Article | null> {
  const row = await db.article.findUnique({
    where: { id },
    include: { concepts: { include: { concept: true } } },
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    source_url: row.sourceUrl ?? undefined,
    raw_text: row.rawText,
    created_at: row.createdAt.toISOString(),
    sections: {
      mechanism: row.mechanism,
      history: row.history,
      uncertainty: row.uncertainty,
    },
    concepts: row.concepts.map((ac) => ({
      name: ac.concept.name,
      layer: ac.concept.layer as Layer,
    })),
  };
}

export async function listConcepts(): Promise<ConceptListItem[]> {
  const rows = await db.concept.findMany({
    include: { _count: { select: { appearances: true } } },
  });
  return rows.map((c) => ({
    name: c.name,
    layer: c.layer as Layer,
    firstSeen: c.firstSeen.toISOString(),
    appearanceCount: c._count.appearances,
  }));
}

export async function getConcept(name: string): Promise<ConceptDetail | null> {
  const row = await db.concept.findUnique({
    where: { name },
    include: {
      appearances: {
        include: { article: { select: { id: true, title: true, createdAt: true } } },
        orderBy: { article: { createdAt: 'desc' } },
      },
    },
  });
  if (!row) return null;
  return {
    name: row.name,
    layer: row.layer as Layer,
    definition: row.definition,
    firstSeen: row.firstSeen.toISOString(),
    appearances: row.appearances.map((ac) => ({
      id: ac.article.id,
      title: ac.article.title,
      createdAt: ac.article.createdAt.toISOString(),
    })),
  };
}
