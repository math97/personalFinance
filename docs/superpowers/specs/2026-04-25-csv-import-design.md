# CSV Import — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Goal

Allow users to upload bank statement CSV files as an alternative to PDF/photo uploads. Parsed transactions flow into the existing ImportBatch → review → confirm pipeline with no changes to downstream code.

## Scope

- CSV import only. OFX explicitly out of scope.
- Single opinionated format. No column-mapping UI.

## Expected CSV Format

```
date,description,amount
2024-04-01,Netflix,-17.99
2024-04-03,Salary,2500.00
```

Rules:
- First row must be the header: `date,description,amount` (case-insensitive)
- `date`: `YYYY-MM-DD` or `DD/MM/YYYY`
- `amount`: numeric, negative = expense, positive = income
- Rows with unparseable date or non-numeric amount are silently skipped

---

## Architecture

### Backend

**New file: `code/apps/backend/src/lib/csv-parser.ts`**

An `@Injectable()` class `CsvParser` with one public method:

```typescript
parse(buffer: Buffer): ExtractedTransaction[]
```

- Decodes buffer as UTF-8
- Validates header row matches `date,description,amount` — throws `BadRequestException` if not
- Parses each data row, skipping blank lines and malformed rows
- Accepts dates in `YYYY-MM-DD` and `DD/MM/YYYY`; normalises to `YYYY-MM-DD`
- Returns `ExtractedTransaction[]` (same type used by `AIPort`)

No abstract port. No DI token. Injected directly by class reference.

**Modified: `code/apps/backend/src/modules/import/import.service.ts`**

In `uploadAndExtract()`, add a CSV branch before the existing AI branch:

```
if file extension is .csv:
  call CsvParser.parse(buffer)
  skip AI extraction
  run categorization on parsed rows (same as today)
  set batch source = 'csv'
else:
  existing PDF/photo AI path
```

File-type detection: use the `.csv` extension (`.csv` files are plain text — `file-type` can't detect them by magic bytes).

**Modified: `code/apps/backend/src/modules/import/import.module.ts`**

Add `CsvParser` to providers.

**Confirmed transaction source**

`confirmBatch()` currently sets source as `'pdf'` or `'photo'` based on `batch.isPdf()`. Extend this to also handle `'csv'`:

```typescript
const source = batch.filename.toLowerCase().endsWith('.csv') ? 'csv'
             : batch.isPdf() ? 'pdf'
             : 'photo'
```

No schema change needed — `source` is a free-form string field.

---

### Frontend

**Modified: `code/apps/frontend/src/app/import/page.tsx`**

1. Add `.csv` / `text/csv` to dropzone `accept`
2. Update hint text: `PDF, JPG, PNG, HEIC, CSV`
3. Add an `ⓘ` icon next to the hint text. On hover, show a tooltip:

```
Expected CSV format:
date,description,amount
• date: YYYY-MM-DD or DD/MM/YYYY
• amount: negative for expenses
```

Tooltip implemented inline with Tailwind — no new component needed.

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Wrong/missing header | `BadRequestException`: "Invalid CSV format. Expected header: date,description,amount" |
| Row with bad date | Row skipped silently |
| Row with non-numeric amount | Row skipped silently |
| Empty file / no data rows | `BadRequestException`: "CSV file contains no valid transactions" |
| File too large (>20 MB) | Rejected by existing Multer limit |

---

## Testing

**New: `code/apps/backend/src/tests/csv-parser.spec.ts`**

Unit tests for `CsvParser`:

| Test | Expected |
|---|---|
| Valid file, ISO dates | Returns correct `ExtractedTransaction[]` |
| Valid file, DD/MM/YYYY dates | Dates normalised to YYYY-MM-DD |
| Wrong header | Throws `BadRequestException` |
| Row with non-numeric amount | Row skipped, rest returned |
| Row with unparseable date | Row skipped, rest returned |
| Empty file | Throws `BadRequestException` |
| File with only header, no data rows | Throws `BadRequestException` |
| Negative and positive amounts | Both preserved correctly |

---

## File Map

| Action | Path |
|---|---|
| Create | `code/apps/backend/src/lib/csv-parser.ts` |
| Create | `code/apps/backend/src/tests/csv-parser.spec.ts` |
| Modify | `code/apps/backend/src/modules/import/import.service.ts` |
| Modify | `code/apps/backend/src/modules/import/import.module.ts` |
| Modify | `code/apps/frontend/src/app/import/page.tsx` |
