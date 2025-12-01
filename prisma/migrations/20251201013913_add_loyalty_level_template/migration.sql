-- CreateTable
CREATE TABLE "loyalty_level_templates" (
    "id" SERIAL NOT NULL,
    "level" TEXT NOT NULL,
    "foto" TEXT NOT NULL,

    CONSTRAINT "loyalty_level_templates_pkey" PRIMARY KEY ("id")
);
