# Frontend — Claude Code Instructions

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS v4, `tailwind-variants` (`tv`), `tailwind-merge` (`twMerge`).

## Styling

### Tailwind v4 — `@theme` and canonical classes

Colors and fonts are configured in `src/app/globals.css` via `@theme`. Use canonical Tailwind class names — **never** arbitrary-value syntax for tokens that are already in the theme.

```css
/* globals.css — already in place */
@theme inline {
  --color-accent: var(--accent);
  --color-surface: var(--surface);
  --font-sans: system-ui, -apple-system, sans-serif;
  /* … */
}
```

Correct usage:
```tsx
// ✅ canonical
<p className="text-accent font-sans bg-surface" />

// ❌ wrong — arbitrary value for a theme token
<p className="text-[--color-accent] font-primary bg-[--surface]" />
<p className="text-(--color-white)" />   // → text-white
```

### Font family

Define the default font via `@theme { --font-sans: ... }` — never via a custom `.font-primary` utility class. Use `font-sans` (or `font-mono` etc.) in JSX.

### `twMerge` instead of string interpolation

Use `twMerge` (or the `cn` helper) for conditional/merged class strings — never template literals.

```tsx
// ✅
import { twMerge } from 'tailwind-merge'
const cls = twMerge('px-4 py-2', isActive && 'bg-accent text-bg')

// ❌
const cls = `px-4 py-2 ${isActive ? 'bg-accent text-bg' : ''}`
```

### `tailwind-variants` (`tv`)

Use `tv` for components with variants. Pass `className` directly into `tv` — never merge manually before passing.

```tsx
// ✅
import { tv } from 'tailwind-variants'

const button = tv({
  base: 'rounded-lg px-4 py-2 text-sm font-semibold',
  variants: {
    intent: {
      primary: 'bg-accent text-bg',
      ghost:   'bg-transparent text-text-2',
    },
  },
})

function Button({ intent, className, ...props }: ButtonProps) {
  return <button className={button({ intent, className })} {...props} />
}

// ❌ — don't twMerge before passing to tv
const cls = twMerge(button({ intent }), className)
```

## Components

### Extend native HTML element props

Every component wrapping an HTML element must extend its native props so consumers get full type safety and can pass any native attribute.

```tsx
// ✅
interface ButtonProps extends React.ComponentProps<'button'> {
  intent?: 'primary' | 'ghost'
}

// ❌ — too restrictive
interface ButtonProps {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}
```

### Named exports only

Never use `export default`. Always use named exports.

```tsx
// ✅
export function Button({ ... }: ButtonProps) { ... }

// ❌
export default function Button() { ... }
```

### `components/ui/` for generic reusable components

Generic, design-system-level components (Button, Card, Badge, Input, Select…) live in `src/components/ui/`. Feature-specific components live in `src/components/` directly or colocated in the page file.

```
src/components/
  ui/
    button.tsx       ← generic, reusable
    card.tsx
    badge.tsx
  upcoming-panel.tsx ← feature-specific
  budget-bar.tsx
```

## Exports

- Named exports everywhere — no `export default`
- One component per file in `components/ui/`

## Inline styles

Use CSS variable inline styles only for values **not** expressible as Tailwind classes (e.g. dynamic hex colors from the DB). For all static design tokens, prefer Tailwind classes.

```tsx
// ✅ — dynamic color from data
<span style={{ color: category.color }} />

// ❌ — static token that exists in theme
<span style={{ color: 'var(--accent)' }} />   // → className="text-accent"
```
