import Link from 'next/link';
import { getConcept } from '@/lib/data';
import LocalTime from '@/components/LocalTime';

// Always read the latest from the DB.
export const dynamic = 'force-dynamic';

export default async function ConceptDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const concept = await getConcept(decoded);

  if (!concept) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">Concept not found.</p>
        <Link href="/concepts" className="text-sm text-blue-600 hover:underline">
          回概念库
        </Link>
      </main>
    );
  }

  const { appearances } = concept;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header>
        <div className="flex items-baseline gap-2">
          <span className="text-zinc-500 text-xs">{concept.layer}</span>
          <h1 className="text-2xl font-semibold">{concept.name}</h1>
        </div>
        <p className="text-xs text-zinc-500 mt-1">
          首次出现 <LocalTime iso={concept.firstSeen} />
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-2">定义</h2>
        <p className="text-sm leading-7">{concept.definition}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">
          出现过的新闻 ({appearances.length})
        </h2>
        {appearances.length === 0 ? (
          <p className="text-sm text-zinc-500">关联的文章已被清除.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {appearances.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2">
                <Link
                  href={`/article/${a.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {a.title}
                </Link>
                <span className="text-xs text-zinc-400">
                  <LocalTime iso={a.createdAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
