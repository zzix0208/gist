export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        Article {id} — 待 Step 5 实现
      </p>
    </main>
  );
}
