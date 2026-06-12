# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the application code. Feature slices live in `src/features/*` (components, services, hooks, and utils per domain).
- Route files are in `src/routes/` with TanStack Router; the generated tree is `src/routeTree.gen.ts`.
- Shared UI and utilities live in `src/components/`, `src/lib/`, `src/hooks/`, and `src/services/`.
- Database schema and seed logic are in `src/drizzle/` with Drizzle Kit config at `drizzle.config.ts`.
- `src/drizzle/schema.ts` is the authoritative source for database structure and must be referenced whenever database schema details are needed.
- Static assets and logos are in `public/`.
- Do not hand-edit generated files such as `src/routeTree.gen.ts`; let the framework regenerate them.

## Engineering Expectations
- Favor maintainability over cleverness. Write code that is easy to trace, review, and extend.
- Reusability is a priority. Before adding new helpers, hooks, or UI primitives, check whether an existing shared abstraction can be extended instead.
- Avoid copy-paste business logic. If the same rule appears in more than one place, extract it into a typed helper, shared service, or reusable component.
- Keep responsibilities separated: validation and normalization belong in schemas/helpers, persistence in server-side services, and UI components should stay focused on rendering and interaction.
- Preserve permission boundaries on the server. Hiding fields or actions in the UI is not sufficient protection.
- Prefer small composable functions, explicit types, and predictable data flow over large multi-purpose components or helpers.

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
- Follow existing project patterns before inventing new ones. This codebase already has established patterns for forms, tables, queries, permissions, and server mutations.
- Prefer extending existing `src/components/ui/*`, `src/components/form-components/*`, `src/lib/*`, and `src/hooks/*` utilities before creating parallel abstractions.

## Application Patterns
- Use `createServerFn` for server reads/writes and keep them in feature service files such as `src/features/<domain>/services/*.api.ts`.
- Protect server functions with the appropriate middleware and permission checks. Common patterns are `authMiddleware`, `requirePermission`, and `requireAnyPermission`.
- For write operations, prefer returning `success(...)` / `failure(...)` from `src/lib/result.ts` and log meaningful mutations through `src/services/activity-logger.ts`.
- Keep TanStack Query query definitions in feature-level `services/queries.ts` files and reuse them from routes/components instead of duplicating query logic inline.
- Use Zod schemas for form/server validation and normalize values before persistence. Trim strings, collapse empty strings to `null` where appropriate, and keep this logic in reusable helpers.
- Prefer `useAppForm` and existing form components for forms. For create/update flows, reuse the established `useFormUpsert` pattern where it fits.
- Multi-section forms should use small field-group components and shared form options rather than one very large component.
- When a form can be edited over time, protect dirty state with the existing navigation guard pattern from `src/hooks/use-prevent-navigation.ts`.
- For data tables and index pages, follow the existing pattern of `BasePageComponent` + feature table component + route-level filter state.
- New create/edit routes should mirror existing route conventions: loader-driven data fetching, pending loaders where useful, permission checks in `beforeLoad`, and wrapper/back-link components for page layout.

## Testing Guidelines
- Tests use Vitest; preferred naming is `*.test.ts(x)` or `*.spec.ts(x)`.
- No test files are currently tracked under `src/`, so add tests alongside new features when possible.
- Add focused tests for new helpers, schema logic, and non-trivial business rules. Prefer small targeted tests over broad brittle coverage.
- Run targeted verification for the files you touch: at minimum `pnpm typecheck`, relevant Vitest coverage, and scoped Biome checks when practical.
- Avoid repo-wide formatting churn when the tree is already dirty or when unrelated files have existing lint/format issues.

## Commit & Pull Request Guidelines
- Recent commits use short, sentence-style messages without prefixes (for example, "add permission and remove wip state").
- PRs should include a concise summary, key commands run, and screenshots for UI changes; link issues when available.

## Configuration & Environment
- Copy `env.example` to `.env` and update values as needed.
- Runtime environment typing is in `src/env.ts`; prefer adding new variables there.
- When database schema changes are made, generate and commit the corresponding Drizzle migration artifacts instead of leaving schema-only changes.
