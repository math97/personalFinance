-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "aiProvider" TEXT NOT NULL DEFAULT 'openrouter',
    "aiApiKey" TEXT NOT NULL DEFAULT '',
    "aiModel" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
