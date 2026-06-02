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
      <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-muted">Concept not found.</p>
        <Link href="/concepts" className="text-sm text-link underline underline-offset-2 decoration-faint hover:decoration-foreground">
          Back to concepts
        </Link>
      </main>
    );
  }

  const { appearances } = concept;

  return (
    <main className="max-w-2xl mx-auto px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col gap-8">
      <header>
        <div className="flex items-baseline gap-2">
          <span className="text-faint text-xs">{concept.layer}</span>
          <h1 className="text-[28px] leading-tight tracking-tight font-semibold">{concept.name}</h1>
        </div>
        <p className="text-xs text-faint mt-1">
          First seen <LocalTime iso={concept.firstSeen} />
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Definition</h2>
        <p className="text-[15px] leading-7">{concept.definition}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          Appears in ({appearances.length})
        </h2>
        {appearances.length === 0 ? (
          <p className="text-sm text-muted">Linked articles have been cleared.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {appearances.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2">
                <Link
                  href={`/article/${a.id}`}
                  className="text-sm text-link underline underline-offset-2 decoration-faint hover:decoration-foreground"
                >
                  {a.title}
                </Link>
                <span className="text-xs text-faint">
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
