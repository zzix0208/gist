import Link from 'next/link';
import { listConcepts } from '@/lib/data';
import SortableConceptList from './_components/SortableConceptList';

// Always read the latest concepts from the DB.
export const dynamic = 'force-dynamic';

export default async function ConceptsPage() {
  const concepts = await listConcepts();

  if (concepts.length === 0) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-muted">No concepts yet.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2 decoration-faint hover:decoration-foreground">
          Paste a news story on the home page to try
        </Link>
      </main>
    );
  }

  return <SortableConceptList concepts={concepts} />;
}
