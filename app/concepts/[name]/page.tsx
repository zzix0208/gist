export default async function ConceptPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        Concept {decodeURIComponent(name)} — 待 Step 6 实现
      </p>
    </main>
  );
}
