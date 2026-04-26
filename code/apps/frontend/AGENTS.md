# Frontend Agent Instructions

This file applies to `code/apps/frontend/` and its descendants.
Next.js in this repo has breaking changes relative to common defaults, so read the relevant guide in `node_modules/next/dist/docs/` before changing app behavior.

## Scope

- Next.js App Router frontend
- TypeScript, Tailwind CSS v4, `tailwind-merge`, and `tailwind-variants`
- Shared UI components in `src/components/` and `src/components/ui/`

## Core Rules

| Rule | Do | Don't |
|---|---|---|
| Theme tokens | Use canonical Tailwind classes from `@theme` | Use arbitrary token syntax for existing theme values |
| Class merging | Use `twMerge` or the local `cn` helper | Build conditional classes with template strings |
| Variants | Use `tv()` and pass `className` into it | Merge classes manually before calling `tv()` |
| Native props | Extend `React.ComponentProps<'button'>` and similar | Re-declare common DOM props by hand |
| Exports | Use named exports | Use `export default` |
| Shared UI | Put reusable primitives in `src/components/ui/` | Duplicate generic components inside pages |
| Dynamic color | Use inline styles only for data-driven values | Hard-code hex values into class names |

## Styling Rules

- Use `font-sans` via the theme configuration, not a custom font utility.
- Prefer Tailwind utilities for static tokens that already exist in `globals.css`.
- Keep class composition consistent with the existing `cn` helper and component patterns.

## Component Rules

- Keep feature-specific components close to the feature.
- Keep generic controls in `src/components/ui/`.
- Prefer named exports for everything.
- Make sure wrapper components pass through native HTML props.

## Commands

```bash
cd code/apps/frontend
npm run dev
npm test
npm run test:e2e
```

## Reference Files

- App-level guidance: [`CLAUDE.md`](CLAUDE.md)
- Theme tokens: `src/app/globals.css`
- Reusable primitives: `src/components/ui/`
