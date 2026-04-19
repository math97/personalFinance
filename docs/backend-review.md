# Backend Review — 2026-04-19

## Executive Summary

The backend is well-structured for an early-stage personal finance app. The repository pattern is consistently applied, the DDD layer separation is clean, and the AI abstraction is a genuine improvement over the previous `ClaudeService`. However, there are **two high-severity issues** that must be fixed before any production use: (1) the file upload endpoint has no MIME-type spoofing protection and no file extension guard, and (2) the `confirmBatch` flow has a race condition that can duplicate transactions. There are also several medium-severity issues around input validation gaps, dead code, a broken test import, and missing error boundaries on AI calls.

---

## 🔴 Critical (fix before production)

### 1. File upload: MIME type is spoofed from request headers, not file content
**File:** `src/modules/import/import.service.ts:31-33`

```typescript
const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
if (!allowed.includes(file.mimetype)) {
  throw new BadRequestException('Unsupported file type')
}
```

`file.mimetype` is taken from the `Content-Type` header the client sends, not from the actual file bytes. An attacker can upload any arbitrary file (executable, ZIP, XML bomb) with `Content-Type: application/pdf` and it passes validation, gets base64-encoded, and is forwarded to the Anthropic API with ~20 MB of attacker-controlled data.

**Fix:** Use a library like `file-type` (reads the magic bytes from the buffer) to validate the actual format:

```typescript
import { fileTypeFromBuffer } from 'file-type'
const detected = await fileTypeFromBuffer(file.buffer)
const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
if (!detected || !allowed.has(detected.mime)) {
  throw new BadRequestException('Unsupported file type')
}
```

Also add a Multer-level `fileFilter` callback in `import.module.ts` as a second layer of defence before the buffer even reaches the service.

---

### 2. `confirmBatch` race condition: concurrent calls can duplicate transactions
**File:** `src/modules/import/import.service.ts:79-98`

```typescript
async confirmBatch(batchId: string) {
  const batch = await this.findBatch(batchId)        // read
  if (!batch.isReviewing()) { ... }

  for (const imp of batch.imported.filter(i => !i.transactionId)) {
    const tx = await this.txRepo.save(...)            // write
    await this.batchRepo.promoteToTransaction(...)     // write
  }
  await this.batchRepo.updateStatus(batchId, 'confirmed')   // final write
}
```

There is no database-level lock. Two simultaneous calls to `POST /api/import/batches/:id/confirm` will both pass the `isReviewing()` check (both read `status = 'reviewing'`) before either has written `status = 'confirmed'`, resulting in every imported transaction being promoted twice, creating duplicate real transactions.

**Fix:** Wrap the entire confirmation in a Prisma transaction with a `SELECT ... FOR UPDATE` or use an optimistic update — change status to `'confirmed'` atomically as part of the first write, and return early if the update affected zero rows:

```typescript
// inside PrismaImportBatchRepository
async confirmBatch(batchId: string): Promise<ImportBatchEntity | null> {
  return this.prisma.$transaction(async (tx) => {
    const updated = await tx.importBatch.updateMany({
      where: { id: batchId, status: 'reviewing' },
      data: { status: 'confirmed' },
    })
    if (updated.count === 0) return null  // already confirmed / concurrent call lost the race
    return tx.importBatch.findUnique({ where: { id: batchId }, include: { imported: true } })
  })
}
```

---

### 3. Dashboard endpoint: no input validation — `NaN` crashes the service silently
**File:** `src/modules/dashboard/dashboard.controller.ts:7-17`

```typescript
@Get('summary')
getSummary(
  @Query('year') year: string,
  @Query('month') month: string,
) {
  return this.service.getSummary(
    Number(year ?? now.getFullYear()),
    Number(month ?? now.getMonth() + 1),
  )
}
```

`Number(undefined)` is `NaN`. If `year` or `month` is missing or non-numeric, `NaN` is passed into `getMonthlyTotals`, `new Date(NaN, NaN - 1)` returns `Invalid Date`, and every `date-fns` function called on it throws or returns `Invalid Date` objects that Prisma then rejects with an unhelpful 500 error.

**Fix:** Add a query DTO with `@IsNumberString()` and `@IsOptional()` decorators (matching the pattern already used in `TransactionQueryDto`), then coerce to numbers in the service or controller with safe fallbacks.

---

## 🟡 Medium (should fix soon)

### 4. Dead code: `ClaudeService` (`lib/claude.service.ts`) was not removed after the AIPort refactor
**File:** `src/lib/claude.service.ts` (entire file, 77 lines)

The AIPort / adapter refactor is complete and `ImportService` now injects `AIPort`. However, `ClaudeService` still exists in `src/lib/` and is **imported by the test file** (`import.service.spec.ts:8`) even though it is never actually used by the test (only `claudeMock` is used, typed as a bare object). The dead import masks the real DI token (`AIPort`) and will confuse any developer trying to understand which service handles AI.

**Fix:** Delete `src/lib/claude.service.ts`. Update `import.service.spec.ts` to remove the unused import and provide `AIPort` instead of `ClaudeService` as the mock token:

```typescript
{ provide: AIPort, useValue: { extractTransactions: jest.fn(), suggestCategory: jest.fn() } }
```

---

### 5. `AICategorizationPort` is imported from `categorization.domain-service.ts` but never exported there
**File:** `src/tests/import.service.spec.ts:7` and `src/tests/categorization.domain-service.spec.ts:1`

```typescript
import { CategorizationDomainService, AICategorizationPort } from '../domain/services/categorization.domain-service'
```

`AICategorizationPort` does not exist in `categorization.domain-service.ts`. The actual port is `AIPort` from `src/domain/ports/ai.port.ts`. TypeScript resolves the import as `undefined` at runtime (it is only used as a type annotation), so the tests pass — but this is misleading, creates a TypeScript error at strict compile time, and will break if `isolatedModules` or `verbatimModuleSyntax` is enabled.

**Fix:** Remove the non-existent import. In both test files, type the AI mock explicitly or import `AIPort`:

```typescript
import { AIPort } from '../domain/ports/ai.port'
const aiPort: Pick<AIPort, 'suggestCategory'> = { suggestCategory: jest.fn() }
```

---

### 6. `categorization.domain-service.ts`: rule match incorrectly sets `aiCategorized: true`
**File:** `src/domain/services/categorization.domain-service.ts:19-21`

```typescript
const ruleMatch = applyRules(description, rules)
if (ruleMatch) {
  return { categoryId: ruleMatch, aiCategorized: true }  // ← wrong flag
}
```

A rule match is explicitly *not* AI categorization — the AI was never called. The flag `aiCategorized: true` on a rule match is semantically wrong and will mislead any future logic that distinguishes between rule-based and AI-based categorization (e.g. UI badges, analytics, retraining signals).

**Fix:**

```typescript
if (ruleMatch) {
  return { categoryId: ruleMatch, aiCategorized: false }
}
```

Note: the existing test at `categorization.domain-service.spec.ts:22` (`expect(result.aiCategorized).toBe(true)`) also asserts the wrong value. Fix the test assertion to `toBe(false)`.

---

### 7. `PATCH /transactions/:id` and `PATCH /categories/:id`: update body is unvalidated `Partial<CreateXDto>`
**File:** `src/modules/transactions/transactions.controller.ts:26` and `src/modules/categories/categories.controller.ts:25`

```typescript
update(@Param('id') id: string, @Body() dto: Partial<CreateTransactionDto>) { ... }
```

`Partial<CreateTransactionDto>` makes every field optional, but the `@IsNumber()`, `@IsString()`, etc. decorators in class-validator do NOT apply to optional/missing fields, **they do apply to present fields**. However, because the type is inferred as `Partial<CreateTransactionDto>` rather than a dedicated `UpdateTransactionDto` class, class-transformer cannot instantiate the right class — NestJS will receive a plain object and skip all validators.

**Fix:** Create explicit `UpdateTransactionDto` and `UpdateCategoryDto` classes with every field `@IsOptional()` decorated, and use them in the controller. This is a pattern already correctly followed in `UpdateImportedTransactionDto`.

---

### 8. `forbidNonWhitelisted: false` leaves the door open for extra properties to pass silently
**File:** `src/main.ts:11`

```typescript
new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false })
```

`whitelist: true` strips extra properties, but `forbidNonWhitelisted: false` means no error is thrown when unknown fields are sent — they are silently stripped. This is safe against injection but hides client bugs (e.g. a typo in a field name) with no feedback. For a personal finance app where you write both frontend and backend, `forbidNonWhitelisted: true` is low-risk and aids debugging.

**Recommendation:** Set `forbidNonWhitelisted: true`.

---

### 9. `getMonthlyTotals` makes sequential awaits in a loop — N serial DB round-trips
**File:** `src/modules/dashboard/dashboard.service.ts:37-48`

```typescript
for (let i = months - 1; i >= 0; i--) {
  ...
  results.push({
    ...
    total: await this.txRepo.monthlyTotal(y, m),   // sequential — 4 DB calls, not parallel
  })
}
```

Four months of totals are fetched with four sequential database calls. For a dashboard that is already making several other parallel calls (`Promise.all` on line 53), this is a noticeable latency regression.

**Fix:** Collect the promises and resolve them in parallel:

```typescript
const promises = Array.from({ length: months }, (_, i) => {
  const d = subMonths(reference, months - 1 - i)
  const y = d.getFullYear(), m = d.getMonth() + 1
  return this.txRepo.monthlyTotal(y, m).then(total => ({ label: format(d, 'MMM'), year: y, month: m, total }))
})
return Promise.all(promises)
```

---

### 10. No rate limiting on the AI upload endpoint
**File:** `src/modules/import/import.controller.ts:23-27`

`POST /api/import/upload` calls the Anthropic (or OpenRouter) API on every request. There is no rate limiting, no per-user quota, and no request queue. A single client (or a misconfigured frontend retry loop) can exhaust the API key's quota and run up substantial costs.

**Fix:** Add `@nestjs/throttler` with a conservative limit (e.g. 5 uploads/minute) applied specifically to the upload endpoint. For a personal app, even a simple in-memory throttler is sufficient.

---

### 11. `InMemoryCategoryRepository.save` uses the entity's empty-string `id` directly
**File:** `src/infrastructure/repositories/in-memory/in-memory-category.repository.ts:22-24`

```typescript
async save(entity: CategoryEntity): Promise<CategoryEntity> {
  this.store.set(entity.id, entity)   // entity.id is '' — stored under key ''
  return entity
}
```

`CategoriesService.create` passes `new CategoryEntity('', ...)`. Unlike `InMemoryTransactionRepository.save` (which uses `entity.id || crypto.randomUUID()`), the category repo stores the entity under the key `''`. Any subsequent `findById('')` would return *every* category ever created with an empty id. The Prisma implementation is not affected (Prisma generates the id), but tests calling `service.create` followed by `service.findOne` on the returned entity will silently succeed because the test does not look up by id directly.

**Fix:** Mirror the transaction repo pattern:

```typescript
async save(entity: CategoryEntity): Promise<CategoryEntity> {
  const id = entity.id || crypto.randomUUID()
  const persisted = new CategoryEntity(id, entity.name, entity.color, entity.rules, entity.transactionCount)
  this.store.set(id, persisted)
  return persisted
}
```

---

## 🟢 Low / Improvements (nice to have)

### 12. Mappers accept `any` — losing Prisma's type safety
**Files:** `src/infrastructure/repositories/prisma/transaction.mapper.ts:4`, `category.mapper.ts:5`, `import-batch.mapper.ts:5`

```typescript
static toDomain(p: any): TransactionEntity { ... }
```

Using `any` for the Prisma shape means typos in field names (e.g. `p.categoryI` instead of `p.categoryId`) will compile and silently produce `undefined` at runtime. Prisma generates exact types for every `include` combination.

**Fix:** Define narrow types matching the `include` shape (or use `Prisma.TransactionGetPayload<{ include: { category: true } }>`) as the parameter type.

---

### 13. `AppController` / `AppService` are default scaffolding and are not registered in `AppModule`
**Files:** `src/app.controller.ts`, `src/app.service.ts`

`AppModule` does not declare `AppController` or `AppService` in its `controllers` / `providers` arrays (they were presumably removed from `AppModule` to keep it clean, but the files were left). They are unreachable dead code.

**Fix:** Delete both files.

---

### 14. CORS is hardcoded to `localhost:3000` — no env-driven override
**File:** `src/main.ts:14`

```typescript
app.enableCors({ origin: 'http://localhost:3000' })
```

Fine for local dev, but deploying to any staging/production URL will break all browser requests.

**Fix:** `app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' })`.

---

### 15. AI API key falls back to `ANTHROPIC_API_KEY` without logging a warning
**File:** `src/infrastructure/ai/anthropic.adapter.ts:11-13`

```typescript
this.client = new Anthropic({
  apiKey: process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY,
})
```

If neither env var is set, the Anthropic SDK will throw at request time (not at startup), producing a confusing runtime error rather than a clear startup message. `OpenRouterAdapter` (line 13) does not even fall back to `ANTHROPIC_API_KEY` — a misconfigured `AI_PROVIDER=openrouter` with no `AI_API_KEY` will fail silently with an empty key.

**Fix:** Validate env vars at startup in `AppModule` using NestJS's `ConfigModule` with a Joi/Zod schema, or throw explicitly in each adapter constructor.

---

### 16. `description` field in `CreateTransactionDto` has no length constraint
**File:** `src/modules/transactions/dto/create-transaction.dto.ts:12`

```typescript
@IsString()
description: string
```

No `@MaxLength()` decorator. A client could send a 10 MB description string, which would be stored in PostgreSQL (VARCHAR is unbounded by default without a column constraint in Prisma) and returned in every transaction list response.

**Fix:** Add `@MaxLength(500)` (or whatever is appropriate for your UI) and add a corresponding `@db.VarChar(500)` annotation in the Prisma schema.

---

### 17. `search` query param has no length limit and is passed directly to Prisma `contains`
**File:** `src/infrastructure/repositories/prisma/prisma-transaction.repository.ts:41-43`

```typescript
if (filters.search) {
  where.description = { contains: filters.search, mode: 'insensitive' }
}
```

Prisma's `contains` with `mode: 'insensitive'` compiles to a PostgreSQL `ILIKE '%..%'` query. An unusually long search string is harmless for injection (Prisma parameterises queries) but will force a full-table scan and can become a denial-of-service vector.

**Fix:** Add `@MaxLength(100)` to `TransactionQueryDto.search`.

---

### 18. `isPdf()` in `ImportBatchEntity` relies on filename extension, not MIME type
**File:** `src/domain/entities/import-batch.entity.ts:18-20`

```typescript
isPdf(): boolean {
  return this.filename.toLowerCase().endsWith('.pdf')
}
```

The filename is the original upload name from the client (`file.originalname`). A client can rename a JPEG to `statement.pdf`, causing `isPdf()` to return `true` and the `confirmBatch` source to be set to `'pdf'` for what is actually an image import.

This is a low-severity cosmetic issue for now, but if source-specific processing ever diverges, it will cause bugs.

**Fix:** Store the detected MIME type on the `ImportBatch` model (add a `mimeType` column) and base `isPdf()` on that.

---

### 19. `saveRule` does not verify that the `importedTxId` exists before updating
**File:** `src/modules/import/import.service.ts:112-116`

```typescript
async saveRule(importedTxId: string, dto: SaveRuleDto) {
  await this.categoryRepo.addRule(dto.categoryId, dto.keyword)    // rule created
  return this.batchRepo.updateImportedTransaction(importedTxId, { // may throw P2025
    aiCategoryId: dto.categoryId,
  })
}
```

If `importedTxId` does not exist, `updateImportedTransaction` will throw a Prisma `P2025` "Record to update not found" error, but the rule has already been written. This is a partial write — the keyword rule is permanently saved even though the referenced imported transaction does not exist.

**Fix:** Look up the imported transaction first; only then add the rule and update the record.

---

### 20. `openrouter.adapter.ts` uses `as any` to bypass TypeScript on the entire request content
**File:** `src/infrastructure/ai/openrouter.adapter.ts:31,38`

```typescript
const userContent: any[] = isPdf ? [...] : [...]
const response = await (this.client.chat.completions.create as any)({...})
```

These `any` casts hide potential shape mismatches between what OpenRouter expects and what is sent. If the OpenRouter API changes its file upload contract, TypeScript will give no signal.

**Fix:** Define a narrow local type for the OpenRouter-specific payload shape, or use a comment-documented type assertion with a TODO to upstream a proper type when available.

---

## ✅ What's done well

- **Repository Pattern is clean.** Services inject abstract repository classes, never `PrismaService` directly. The DI wiring in every module is correct and consistent.

- **AIPort abstraction is well-designed.** `parseResponse`, `extractionPrompt`, and `categorizationSystem` are correctly factored into the base class so both adapters share the same parsing and prompt logic. Swapping providers via `AI_PROVIDER` env var is a clean runtime toggle.

- **In-memory repositories are accurate.** The `InMemory*` implementations faithfully replicate the Prisma repositories' semantics — pagination math, date range filtering using `date-fns`, `groupByCategory` with `abs()` normalization — making the unit tests genuinely useful rather than just stubs.

- **AI response parsing is defensive.** `parseResponse` in `ai.port.ts` wraps JSON parsing in try/catch, checks `Array.isArray`, and type-narrows each element. A malformed or empty AI response results in `[]` rather than a crash.

- **CategorizationDomainService correctly short-circuits on rule match** before calling the AI, avoiding unnecessary API calls and costs.

- **`confirmBatch` filters already-promoted transactions** (`filter(i => !i.transactionId)`), preventing re-promotion after a partial failure.

- **CORS is restricted** to `localhost:3000` rather than `'*'`.

- **Multer uses memory storage** (no disk writes), eliminating path-traversal risk from file upload storage.

- **`@IsHexColor()` on category color** is a precise validator — better than a generic string check.

- **`ValidationPipe` with `whitelist: true`** strips undeclared properties from all DTOs, preventing property pollution.

- **Test suite covers the critical paths** (upload, confirm, discard, rule matching, AI fallback) with meaningful assertions, not just coverage theatre.

---

## Architecture Diagram (text-based)

```
HTTP Request
     │
     ▼
[Controller]  — @Body() validated DTO (class-validator), @Param(), @Query()
     │
     ▼
[Service]  — orchestrates, throws NotFoundException / BadRequestException
     │
     ├─► [Abstract Repository]  ◄── DI token (abstract class)
     │         │
     │         ├─ [PrismaXRepository]      ← production (real DB)
     │         └─ [InMemoryXRepository]    ← tests (no DB)
     │
     └─► [CategorizationDomainService]
               │
               └─► [AIPort]  ◄── DI token (abstract class)
                       │
                       ├─ [AnthropicAdapter]   (AI_PROVIDER=anthropic, default)
                       └─ [OpenRouterAdapter]  (AI_PROVIDER=openrouter)

Domain Layer:  entities/, repositories/ (abstract), services/, ports/
Infra Layer:   repositories/prisma/, repositories/in-memory/, ai/
Module Layer:  modules/transactions, categories, import, dashboard, ai
```

**Dependency flow (clean, no violations detected):**
- Domain has zero imports from infrastructure or modules.
- Infrastructure imports from domain only.
- Modules import from domain (abstract classes) and infrastructure (concrete implementations via DI wiring).
- No circular dependencies detected.

---

## Recommended Next Steps (prioritised)

| Priority | Action | Effort |
|---|---|---|
| 1 | Fix `confirmBatch` race condition with a Prisma transaction + atomic status check | Medium |
| 2 | Add `file-type` magic-bytes check to `uploadAndExtract` | Low |
| 3 | Fix `dashboard.controller.ts` — add DTO validation for `year`/`month` | Low |
| 4 | Fix `aiCategorized: true` bug on rule match in `categorization.domain-service.ts` + fix test | Low |
| 5 | Delete `src/lib/claude.service.ts`; fix `AICategorizationPort` phantom import in tests | Low |
| 6 | Fix `InMemoryCategoryRepository.save` to generate id for empty-string entities | Low |
| 7 | Create `UpdateTransactionDto` / `UpdateCategoryDto` as explicit validated classes | Low |
| 8 | Add `@nestjs/throttler` to the upload endpoint | Low |
| 9 | Add `@MaxLength` to `description`, `search`, `keyword` fields | Low |
| 10 | Drive `CORS_ORIGIN` and API key validation from environment at startup | Low |
