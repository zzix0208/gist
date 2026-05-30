-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mechanism" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "uncertainty" TEXT NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "name" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "article_concepts" (
    "article_id" TEXT NOT NULL,
    "concept_name" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "article_concepts_pkey" PRIMARY KEY ("article_id","concept_name")
);

-- CreateIndex
CREATE INDEX "articles_created_at_idx" ON "articles"("created_at");

-- CreateIndex
CREATE INDEX "article_concepts_concept_name_idx" ON "article_concepts"("concept_name");

-- AddForeignKey
ALTER TABLE "article_concepts" ADD CONSTRAINT "article_concepts_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_concepts" ADD CONSTRAINT "article_concepts_concept_name_fkey" FOREIGN KEY ("concept_name") REFERENCES "concepts"("name") ON DELETE CASCADE ON UPDATE CASCADE;
