import { PrismaService } from '../../src/prisma/prisma.service'

export async function cleanDb(prisma: PrismaService) {
  await prisma.$executeRaw`
    TRUNCATE TABLE "CategoryRule", "ImportedTransaction", "Transaction", "ImportBatch", "Category", "AppSettings"
    RESTART IDENTITY CASCADE
  `
}
