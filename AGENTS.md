# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the application code. Feature slices live in `src/features/*` (components, services, hooks, and utils per domain).
- Route files are in `src/routes/` with TanStack Router; the generated tree is `src/routeTree.gen.ts`.
- Shared UI and utilities live in `src/components/`, `src/lib/`, `src/hooks/`, and `src/services/`.
- Database schema and seed logic are in `src/drizzle/` with Drizzle Kit config at `drizzle.config.ts`.
- Static assets and logos are in `public/`.

## Build, Test, and Development Commands
- `pnpm dev`: start Vite dev server on port 3000.
- `pnpm build`: create a production build.
- `pnpm serve`: preview the production build locally.
- `pnpm test`: run Vitest in CI mode.
- `pnpm lint`, `pnpm format`, `pnpm check`: Biome lint/format/check.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:pull`: Drizzle migrations workflow.
- `pnpm db:seed`: run the seed script at `src/drizzle/seed/index.ts`.
- `pnpm inngest`: run Inngest dev server; `pnpm dev:all` runs `mprocs`.

## Coding Style & Naming Conventions
- Formatting is enforced by Biome with tabs for indentation and double quotes.
- React components are typically `PascalCase`, hooks are `use-*.tsx`, and files in features are kebab-case (for example, `expense-sheet.tsx`).
- Keep feature-specific logic co-located under the relevant `src/features/<domain>/` folder.

## Testing Guidelines
- Tests use Vitest; preferred naming is `*.test.ts(x)` or `*.spec.ts(x)`.
- No test files are currently tracked under `src/`, so add tests alongside new features when possible.

## Commit & Pull Request Guidelines
- Recent commits use short, sentence-style messages without prefixes (for example, "add permission and remove wip state").
- PRs should include a concise summary, key commands run, and screenshots for UI changes; link issues when available.

## Configuration & Environment
- Copy `env.example` to `.env` and update values as needed.
- Runtime environment typing is in `src/env.ts`; prefer adding new variables there.
