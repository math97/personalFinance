# Frontend — Agent Instructions

Same rules as CLAUDE.md. This file exists so all AI agents (Codex, Gemini CLI, etc.) pick up the same conventions.

## Quick reference

| Rule | Do | Don't |
|---|---|---|
| Font family | `font-sans` via `@theme { --font-sans: ... }` | Custom `.font-primary` utility |
| Theme color classes | `text-accent`, `bg-surface`, `text-white` | `text-[--color-accent]`, `text-(--color-white)` |
| Conditional classes | `twMerge('base', cond && 'extra')` | Template literals `` `base ${cond ? 'extra' : ''}` `` |
| Variants | `tv({ base, variants })`, pass `className` into `tv` | Manual `twMerge` before/after `tv` |
| Native props | `extends React.ComponentProps<'button'>` | Manually re-declare `onClick`, `disabled`, etc. |
| Exports | `export function Foo` | `export default function Foo` |
| Generic components | `src/components/ui/` | Inline in page files |
| Static design tokens | Tailwind class (`text-accent`) | `style={{ color: 'var(--accent)' }}` |
| Dynamic colors | `style={{ color: category.color }}` | Hard-coded hex in className |

## Installed libraries

- `tailwindcss` v4 — utility classes, `@theme` config in `globals.css`
- `tailwind-merge` — `twMerge()` for merging class strings
- `tailwind-variants` — `tv()` for component variants

## `@theme` color tokens available as Tailwind classes

All of these are usable directly as Tailwind utilities (`text-*`, `bg-*`, `border-*`):

```
accent       surface      surface-2
text         text-2       text-3
border       border-2     green
red          amber-bg     accent-dim
```

Example: `text-text-2`, `bg-surface-2`, `border-border`, `text-accent`
