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
        <p className="text-muted">还没有概念.</p>
        <Link href="/" className="text-sm text-link underline underline-offset-2 decoration-faint hover:decoration-foreground">
          去首页粘一条新闻试试
        </Link>
      </main>
    );
  }

  return <SortableConceptList concepts={concepts} />;
}
