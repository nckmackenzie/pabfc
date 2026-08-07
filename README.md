# PABFC

PABFC is a TanStack Start application for running a role-based operations system for Prime Age Beauty and Fitness Center. The app combines member management, attendance, communication, finance, payroll, HR, and reporting in a single codebase.

## What the app covers

- User and role management with permission-gated navigation and server-side access control
- Member management, plans/packages, and member-facing routes
- Attendance tracking and attendance-sync agent endpoints
- Finance workflows for receipts, credit notes, bills, expenses, payments, banking, and journal entries
- HR and payroll workflows for employees, leave, salary structures, salary advances, overtime, loans, payroll periods, and statutory rates
- Operational and financial reporting across members, attendance, finance, HR, and payroll
- Background jobs with Inngest plus integrations for auth, SMS, S3 uploads, and M-Pesa callbacks

## Tech stack

- React 19
- TanStack Start, TanStack Router, and TanStack Query
- TypeScript
- Tailwind CSS 4
- Drizzle ORM with Drizzle Kit
- Better Auth
- Vitest

## Getting started

### Prerequisites

- Node.js 20+
- `pnpm`
- A PostgreSQL database

### Environment

Copy `env.example` to `.env` and fill in the required values.

Typical variables used by this project include:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `VITE_SERVER_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMS_API_KEY`
- `SMS_USERNAME`
- `SMS_SENDERID`
- `AWS_REGION`
- `S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `APP_ENV`

### Install and run

```bash
pnpm install
pnpm dev
```

The Vite dev server runs on `http://localhost:3000`.

## Common scripts

```bash
pnpm dev            # start the app locally on port 3000
pnpm build          # production build
pnpm serve          # preview the production build
pnpm test           # run Vitest in CI mode
pnpm typecheck      # TypeScript checks
pnpm format         # format the repo with Prettier
pnpm format:check   # verify formatting
pnpm inngest        # run the Inngest dev server
pnpm dev:all        # run the app and supporting processes with mprocs
```

## Database workflow

Drizzle schema lives in [`src/drizzle/schema.ts`](./src/drizzle/schema.ts) and re-exports the domain schema modules under `src/drizzle/schemas/`.

Useful commands:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:pull
pnpm db:drop
pnpm db:studio
pnpm db:seed
```

## Project structure

```text
src/
  components/       shared UI and form building blocks
  drizzle/          database schema, migrations, db client, seed data
  features/         feature slices with components, services, hooks, and utils
  hooks/            cross-feature React hooks
  lib/              shared helpers, auth, permissions, integrations
  routes/           file-based TanStack Router routes and API endpoints
  services/         shared server-side services
```

Notable route areas:

- `src/routes/(auth)` for sign-in and password recovery
- `src/routes/app` for the authenticated admin/staff app
- `src/routes/member` for member-facing routes
- `src/routes/api` for auth, uploads, cron, payments, communications, and agent callbacks

## Development conventions

- Do not edit generated files such as `src/routeTree.gen.ts` by hand.
- Prefer feature-local service files for `createServerFn` reads and writes.
- Keep validation in Zod schemas/helpers, persistence in server-side services, and UI components focused on rendering and interaction.
- Reuse shared UI and form primitives before adding new abstractions.
- When the schema changes, generate and commit the corresponding Drizzle migration artifacts.

## Verification

For targeted local verification after changes, prefer:

```bash
pnpm typecheck
pnpm test
pnpm format:check
```
