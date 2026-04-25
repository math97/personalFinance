# CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to upload CSV bank statements that flow into the existing ImportBatch → review → confirm pipeline.

**Architecture:** A new `CsvParser` injectable class in `src/lib/` owns all CSV parsing logic. `ImportService.uploadAndExtract()` detects `.csv` by extension, calls `CsvParser.parse()` instead of the AI adapter, then runs the same categorization and batch creation flow as today. The frontend dropzone gains `.csv` support and an info tooltip showing the expected format.

**Tech Stack:** NestJS, TypeScript, Next.js 14 (App Router), react-dropzone, Tailwind CSS. Test runner: Jest (`npm test` from `code/apps/backend`).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `code/apps/backend/src/lib/csv-parser.ts` | `CsvParser` injectable — parse buffer → `ExtractedTransaction[]` |
| Create | `code/apps/backend/src/tests/csv-parser.spec.ts` | Unit tests for `CsvParser` |
| Modify | `code/apps/backend/src/modules/import/import.service.ts` | CSV branch in `uploadAndExtract()`, fix `confirmBatch()` source |
| Modify | `code/apps/backend/src/modules/import/import.module.ts` | Add `CsvParser` to providers |
| Modify | `code/apps/frontend/src/app/import/page.tsx` | Accept `.csv`, update hint text, add info tooltip |

---

## Task 1: CsvParser with TDD

**Files:**
- Create: `code/apps/backend/src/lib/csv-parser.ts`
- Create: `code/apps/backend/src/tests/csv-parser.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `code/apps/backend/src/tests/csv-parser.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common'
import { CsvParser } from '../lib/csv-parser'

describe('CsvParser', () => {
  let parser: CsvParser

  beforeEach(() => {
    parser = new CsvParser()
  })

  function buf(text: string) {
    return Buffer.from(text, 'utf-8')
  }

  it('parses a valid CSV with ISO dates', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\n2024-04-03,Salary,2500.00`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ date: '2024-04-01', description: 'Netflix', amount: -17.99 })
    expect(result[1]).toEqual({ date: '2024-04-03', description: 'Salary', amount: 2500.00 })
  })

  it('parses DD/MM/YYYY dates and normalises to YYYY-MM-DD', () => {
    const csv = `date,description,amount\n01/04/2024,Netflix,-17.99`
    const result = parser.parse(buf(csv))
    expect(result[0].date).toBe('2024-04-01')
  })

  it('is case-insensitive on the header', () => {
    const csv = `Date,Description,Amount\n2024-04-01,Netflix,-17.99`
    expect(() => parser.parse(buf(csv))).not.toThrow()
  })

  it('throws BadRequestException when header is wrong', () => {
    const csv = `datum,beschreibung,betrag\n2024-04-01,Netflix,-17.99`
    expect(() => parser.parse(buf(csv))).toThrow(BadRequestException)
  })

  it('throws BadRequestException when file is empty', () => {
    expect(() => parser.parse(buf(''))).toThrow(BadRequestException)
  })

  it('throws BadRequestException when there are no data rows', () => {
    const csv = `date,description,amount`
    expect(() => parser.parse(buf(csv))).toThrow(BadRequestException)
  })

  it('skips rows with non-numeric amount and returns the rest', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\n2024-04-02,Bad,notanumber`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Netflix')
  })

  it('skips rows with unparseable date and returns the rest', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\nnot-a-date,Bad,-5.00`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Netflix')
  })

  it('preserves negative and positive amounts', () => {
    const csv = `date,description,amount\n2024-04-01,Expense,-50.00\n2024-04-02,Income,1000.00`
    const result = parser.parse(buf(csv))
    expect(result[0].amount).toBe(-50.00)
    expect(result[1].amount).toBe(1000.00)
  })

  it('skips blank lines silently', () => {
    const csv = `date,description,amount\n2024-04-01,Netflix,-17.99\n\n2024-04-03,Salary,2500.00`
    const result = parser.parse(buf(csv))
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
cd code/apps/backend && npm test -- --testPathPattern="csv-parser" 2>&1 | tail -5
```

Expected: FAIL — `Cannot find module '../lib/csv-parser'`

- [ ] **Step 3: Implement `CsvParser`**

Create `code/apps/backend/src/lib/csv-parser.ts`:

```typescript
import { Injectable, BadRequestException } from '@nestjs/common'
import { ExtractedTransaction } from '../domain/ports/ai.port'

@Injectable()
export class CsvParser {
  parse(buffer: Buffer): ExtractedTransaction[] {
    const text = buffer.toString('utf-8')
    const lines = text.split(/\r?\n/)
    const nonEmpty = lines.filter(l => l.trim() !== '')

    if (nonEmpty.length === 0) {
      throw new BadRequestException('CSV file is empty')
    }

    const header = nonEmpty[0].toLowerCase().trim()
    if (header !== 'date,description,amount') {
      throw new BadRequestException(
        'Invalid CSV format. Expected header: date,description,amount',
      )
    }

    const dataLines = nonEmpty.slice(1)
    if (dataLines.length === 0) {
      throw new BadRequestException('CSV file contains no valid transactions')
    }

    const results: ExtractedTransaction[] = []

    for (const line of dataLines) {
      const parts = line.split(',')
      if (parts.length < 3) continue

      const rawDate = parts[0].trim()
      const description = parts.slice(1, parts.length - 1).join(',').trim()
      const rawAmount = parts[parts.length - 1].trim()

      const date = this.parseDate(rawDate)
      if (!date) continue

      const amount = Number(rawAmount)
      if (isNaN(amount)) continue

      results.push({ date, description, amount })
    }

    if (results.length === 0) {
      throw new BadRequestException('CSV file contains no valid transactions')
    }

    return results
  }

  private parseDate(raw: string): string | null {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(raw)
      if (isNaN(d.getTime())) return null
      return raw
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/')
      const iso = `${year}-${month}-${day}`
      const d = new Date(iso)
      if (isNaN(d.getTime())) return null
      return iso
    }
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code/apps/backend && npm test -- --testPathPattern="csv-parser" 2>&1 | tail -10
```

Expected: all 9 tests pass.

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
cd code/apps/backend && npm test 2>&1 | tail -5
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add code/apps/backend/src/lib/csv-parser.ts \
        code/apps/backend/src/tests/csv-parser.spec.ts
git commit -m "feat: CsvParser — parse CSV buffer into ExtractedTransaction[] with TDD"
```

---

## Task 2: Wire CsvParser into ImportService + ImportModule

**Files:**
- Modify: `code/apps/backend/src/modules/import/import.service.ts`
- Modify: `code/apps/backend/src/modules/import/import.module.ts`

- [ ] **Step 1: Add `CsvParser` to `ImportModule` providers**

In `code/apps/backend/src/modules/import/import.module.ts`, add the import and provider:

```typescript
import { Module } from '@nestjs/common'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { ImportController } from './import.controller'
import { ImportService } from './import.service'
import { SettingsModule } from '../settings/settings.module'
import { RecurringModule } from '../recurring/recurring.module'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { PrismaImportBatchRepository } from '../../infrastructure/repositories/prisma/prisma-import-batch.repository'
import { PrismaCategoryRepository } from '../../infrastructure/repositories/prisma/prisma-category.repository'
import { PrismaTransactionRepository } from '../../infrastructure/repositories/prisma/prisma-transaction.repository'
import { CsvParser } from '../../lib/csv-parser'

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    SettingsModule,
    RecurringModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    CsvParser,
    { provide: ImportBatchRepository, useClass: PrismaImportBatchRepository },
    { provide: CategoryRepository,    useClass: PrismaCategoryRepository    },
    { provide: TransactionRepository, useClass: PrismaTransactionRepository },
  ],
})
export class ImportModule {}
```

- [ ] **Step 2: Inject `CsvParser` into `ImportService` and add the CSV branch**

Replace the full `import.service.ts` with the following (only `uploadAndExtract` and `confirmBatch` change — the rest is unchanged):

```typescript
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { fromBuffer as fileTypeFromBuffer } from 'file-type'
import { ImportBatchRepository } from '../../domain/repositories/import-batch.repository'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { TransactionRepository } from '../../domain/repositories/transaction.repository'
import { CategorizationDomainService } from '../../domain/services/categorization.domain-service'
import { TransactionEntity } from '../../domain/entities/transaction.entity'
import { SettingsService } from '../settings/settings.service'
import { RecurringService } from '../recurring/recurring.service'
import { CsvParser } from '../../lib/csv-parser'
import { UpdateImportedTransactionDto, SaveRuleDto } from './dto/import.dto'

@Injectable()
export class ImportService {
  constructor(
    private readonly batchRepo: ImportBatchRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly txRepo: TransactionRepository,
    private readonly settings: SettingsService,
    private readonly recurring: RecurringService,
    private readonly csvParser: CsvParser,
  ) {}

  findAllBatches() {
    return this.batchRepo.findAllReviewing()
  }

  async findBatch(batchId: string) {
    const batch = await this.batchRepo.findById(batchId)
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`)
    return batch
  }

  async uploadAndExtract(file: Express.Multer.File) {
    const isCsv = file.originalname.toLowerCase().endsWith('.csv')

    if (!isCsv) {
      const ALLOWED_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
      const detected = await fileTypeFromBuffer(file.buffer)
      const effectiveMime = detected?.mime ?? file.mimetype
      if (!ALLOWED_MIMES.has(effectiveMime)) {
        throw new BadRequestException(`Unsupported file type: ${effectiveMime}`)
      }
    }

    const batch = await this.batchRepo.createBatch(file.originalname)

    try {
      const [rules, categories] = await Promise.all([
        this.categoryRepo.findAllRules(),
        this.categoryRepo.findAll(),
      ])
      const catList = categories.map(c => ({ id: c.id, name: c.name }))

      let extracted: { date: string; description: string; amount: number }[]

      if (isCsv) {
        extracted = this.csvParser.parse(file.buffer)
      } else {
        const ai = await this.settings.createAIPort()
        extracted = await ai.extractTransactions(file.buffer, file.mimetype)
      }

      const categorization = isCsv
        ? null
        : new CategorizationDomainService(await this.settings.createAIPort())

      const importedData = await Promise.all(
        extracted.map(async t => {
          let categoryId: string | null = null
          let aiCategorized = false

          if (isCsv) {
            // Rules-only categorization for CSV (no AI call)
            const ruleMatch = rules.find(r =>
              t.description.toLowerCase().includes(r.keyword.toLowerCase())
            )
            categoryId = ruleMatch?.categoryId ?? null
          } else {
            const result = await categorization!.categorize(t.description, rules, catList)
            categoryId = result.categoryId
            aiCategorized = result.aiCategorized
          }

          return {
            batchId: batch.id,
            rawDate: t.date,
            rawDescription: t.description,
            rawAmount: t.amount,
            aiCategoryId: categoryId,
            aiCategorized,
          }
        }),
      )

      await this.batchRepo.createImportedTransactions(importedData)
      await this.batchRepo.updateStatus(batch.id, 'reviewing')

      return { batchId: batch.id, extracted: importedData.length }
    } catch (err) {
      await this.batchRepo.updateStatus(batch.id, 'discarded')
      throw err
    }
  }

  async updateImportedTransaction(id: string, dto: UpdateImportedTransactionDto) {
    return this.batchRepo.updateImportedTransaction(id, {
      rawDate:        dto.rawDate,
      rawDescription: dto.rawDescription,
      rawAmount:      dto.rawAmount,
      aiCategoryId:   dto.aiCategoryId,
    })
  }

  async confirmBatch(batchId: string) {
    const batch = await this.findBatch(batchId)
    if (!batch.isReviewing()) {
      throw new BadRequestException('Batch is not in reviewing state')
    }

    const claimed = await this.batchRepo.tryClaimConfirm(batchId)
    if (!claimed) {
      throw new ConflictException('Batch was already confirmed')
    }

    const filename = batch.filename.toLowerCase()
    const source = filename.endsWith('.csv') ? 'csv'
                 : batch.isPdf()             ? 'pdf'
                 :                             'photo'

    for (const imp of batch.imported.filter(i => !i.transactionId)) {
      const tx = await this.txRepo.save(
        new TransactionEntity(
          '', Number(imp.rawAmount), new Date(imp.rawDate), imp.rawDescription,
          source, imp.aiCategoryId, null, null, null, new Date(),
        ),
      )
      await this.batchRepo.promoteToTransaction(imp.id, tx.id)
    }

    this.recurring.detect().catch(() => {})

    return { confirmed: true }
  }

  async discardBatch(batchId: string) {
    await this.findBatch(batchId)
    await this.batchRepo.delete(batchId)
    return { discarded: true }
  }

  async deleteImportedTransaction(id: string) {
    await this.batchRepo.deleteImportedTransaction(id)
    return { deleted: true }
  }

  async saveRule(importedTxId: string, dto: SaveRuleDto) {
    const updated = await this.batchRepo.updateImportedTransaction(importedTxId, {
      aiCategoryId: dto.categoryId,
    })
    await this.categoryRepo.addRule(dto.categoryId, dto.keyword)
    return updated
  }
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd code/apps/backend && npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add code/apps/backend/src/modules/import/import.service.ts \
        code/apps/backend/src/modules/import/import.module.ts
git commit -m "feat: wire CsvParser into ImportService — CSV branch in uploadAndExtract, csv source in confirmBatch"
```

---

## Task 3: Frontend — CSV dropzone + info tooltip

**Files:**
- Modify: `code/apps/frontend/src/app/import/page.tsx`

- [ ] **Step 1: Add CSV to dropzone accept, update hint text, add tooltip**

In `code/apps/frontend/src/app/import/page.tsx`, make the following changes:

**1. Add `Info` to lucide imports:**

```typescript
import { CloudUpload, FileText, ChevronRight, Loader2, Info } from 'lucide-react'
```

**2. Add tooltip state after the existing state declarations:**

```typescript
const [showTooltip, setShowTooltip] = useState(false)
```

**3. Replace the `useDropzone` accept config:**

```typescript
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic'],
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    multiple: true,
    disabled: uploading,
  })
```

**4. Replace the hint text paragraph and button inside the dropzone (the non-uploading state):**

```tsx
            <CloudUpload size={32} className="mx-auto mb-3"
              style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-2)' }} />
            <p className="text-base font-medium mb-1.5" style={{ color: 'var(--text)' }}>
              Drop files here
            </p>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                Bank statements — PDF, JPG, PNG, HEIC, CSV
              </p>
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={e => { e.stopPropagation(); setShowTooltip(v => !v) }}
                  style={{ color: 'var(--text-3)', lineHeight: 1 }}
                >
                  <Info size={14} />
                </button>
                {showTooltip && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg px-3 py-2.5 text-left z-10"
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-2)',
                      boxShadow: '0 4px 12px #0006',
                    }}
                  >
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
                      Expected CSV format
                    </p>
                    <code
                      className="text-xs block mb-1.5 px-2 py-1 rounded"
                      style={{ background: 'var(--surface)', color: 'var(--accent)', fontFamily: 'monospace' }}
                    >
                      date,description,amount
                    </code>
                    <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-2)' }}>
                      <li>• date: YYYY-MM-DD or DD/MM/YYYY</li>
                      <li>• amount: negative for expenses</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <button className="inline-flex px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
              Browse files
            </button>
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd code/apps/frontend && npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add code/apps/frontend/src/app/import/page.tsx
git commit -m "feat: CSV upload support — accept .csv in dropzone, info tooltip with expected format"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `CsvParser` injectable class with `parse(buffer)` | Task 1 |
| Accepts `YYYY-MM-DD` and `DD/MM/YYYY` | Task 1 |
| Wrong header → `BadRequestException` | Task 1 |
| Empty / no data rows → `BadRequestException` | Task 1 |
| Bad rows skipped silently | Task 1 |
| CSV branch in `uploadAndExtract()` | Task 2 |
| Rules-only categorization for CSV (no AI) | Task 2 |
| `confirmBatch()` source = `'csv'` | Task 2 |
| `CsvParser` added to `ImportModule` providers | Task 2 |
| Dropzone accepts `.csv` | Task 3 |
| Hint text updated | Task 3 |
| ⓘ tooltip with expected format | Task 3 |

**Placeholder scan:** None found.

**Type consistency:** `ExtractedTransaction` imported from `../../domain/ports/ai.port` in both `CsvParser` (Task 1) and used implicitly through the same interface in `ImportService` (Task 2). `CsvParser` injected by class reference throughout — no token mismatch.
