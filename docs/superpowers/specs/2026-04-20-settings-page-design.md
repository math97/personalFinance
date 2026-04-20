# Settings Page — Design Spec

**Date:** 2026-04-20
**Scope:** Settings page covering currency display preference and AI provider configuration

---

## Context

The MVP is complete. Two immediate improvements are needed before tackling Phase 2 features:

1. **Currency symbol** — amounts are hardcoded with `£` throughout the UI. Users should be able to switch to €, $ or R$ without code changes.
2. **AI provider settings** — the backend already has provider-agnostic adapters (Anthropic + OpenRouter) configured via `.env`. Exposing these in the UI removes the need to edit `.env` for switching models or providers.

---

## Layout

Single scrollable page — same 1440×900 shell as all other screens (256px sidebar + 1184px content area). Settings is already in the sidebar nav.

Page header: `Settings` title + subtitle `"Manage your preferences and AI configuration"`.

Two stacked section cards. No tabs — only two sections for now.

---

## Section 1 — General

**Card title:** General

**Currency row**
- Label: `Currency` · subtitle: `"Symbol displayed across all amounts"`
- Three segmented pill buttons: `€ Euro` · `$ Dollar` · `R$ Real`
- Selected pill: amber (`$accent`) fill + dark text
- Unselected: `$surface-2` fill + `$border` stroke
- Behaviour: saved to `localStorage` under key `finance:currency` immediately on click. No save button needed.
- Default: `£` (existing behaviour, treated as implicit fourth option — or migrated to `£ GBP` if the user wants to add it later)

---

## Section 2 — AI Provider

**Card title:** AI Provider

**Provider row**
- Label: `Provider`
- Two toggle pills: `Anthropic` / `OpenRouter` — same amber/surface-2 pattern

**API Key row**
- Label: `API Key` · placeholder: `"sk-..."`
- Password input with show/hide eye icon toggle
- Stored encrypted in DB on Save (never in localStorage)

**Model row**
- Label: `Model` · placeholder: `"google/gemini-2.5-flash-preview"`
- Free-text input — user types the model ID exactly as the provider expects
- Helper text below: `"Enter the model ID exactly as the provider expects it"`

**Test connection button**
- Secondary style button: `Test connection`
- Fires a minimal test request to the configured provider with the entered key + model
- Inline status next to button:
  - Green: `✓ Connection successful`
  - Red: `✗ Invalid key or model`
- Test fires against the current unsaved form values (no need to save first)

**Save button**
- Primary amber button, bottom-right of card
- Persists provider + API key + model to DB via `PATCH /api/settings`
- Shows brief `Saved ✓` confirmation on success

---

## Backend changes required

### New Prisma model
```
model AppSettings {
  id        String  @id @default("singleton")
  aiProvider  String  @default("openrouter")   // "anthropic" | "openrouter"
  aiApiKey    String  @default("")              // encrypted at rest
  aiModel     String  @default("")
}
```
Single row with `id = "singleton"` — only one settings record ever exists.

### New endpoints
- `GET  /api/settings` — returns `{ aiProvider, aiModel }` (never returns raw API key, only a masked indicator `"configured"` or `""`)
- `PATCH /api/settings` — updates provider/key/model
- `POST  /api/settings/test` — fires a minimal AI request with current form values, returns `{ ok: boolean, error?: string }`

### AIModule factory change
Backend reads AI config from DB at request time (falling back to `.env` if DB row not yet created).

---

## Frontend changes required

- `GET /api/settings` on page load to pre-fill provider + model (never the raw key)
- Currency stored in `localStorage` under key `finance:currency`
- All amount display components read `localStorage` for the symbol (default `£` if not set)

---

## Out of scope
- GBP as a selectable currency (already the default hardcoded — can be added to the pill row later)
- Per-category AI model (separate feature)
- Multiple API key slots
- Encryption implementation detail (left to implementation plan)
