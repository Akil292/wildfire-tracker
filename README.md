# Wildfire Tracker

The Milestone 1 foundation for a wildfire intelligence application. It contains a Next.js App Router frontend, Tailwind CSS, PostgreSQL/PostGIS development database, Drizzle ORM migrations, Zod validation, and unit/end-to-end test tooling. No product data sources, maps, authentication, or scheduled processing are included yet.

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Docker Desktop with Docker Compose

## Local development

1. Copy `.env.example` to `.env`.
2. Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` to local-only values, then update `DATABASE_URL` to match them. Do not commit `.env`.
3. Start PostgreSQL with PostGIS:

   ```powershell
   docker compose up -d db
   ```

4. Install dependencies and apply migrations:

   ```powershell
   npm install
   npm run db:migrate
   ```

5. Start the app:

   ```powershell
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Database and PostGIS

`docker-compose.yml` runs the `postgis/postgis` image locally and persists data in the named `postgres_data` Docker volume. `npm run db:migrate` executes the ordered SQL files in `drizzle/`; the initial migration enables the `postgis` extension and creates only generic application metadata. Future geographic tables can therefore use PostGIS types and functions without a separate setup step.

## Environment variables

`.env.example` documents every required name and contains no secrets. `.env` and all other environment-file variants are ignored by Git, except the safe example file. The application starts without a database connection, but database commands require `DATABASE_URL`; it is validated through Zod before a connection is created.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run lint` | Run ESLint. |
| `npm run format:check` | Verify Prettier formatting. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm test` | Run Vitest unit tests. |
| `npm run test:e2e` | Run Playwright (no feature tests are defined yet). |
| `npm run db:migrate` | Apply Drizzle migrations. |
| `npm run db:generate` | Generate a new Drizzle migration from schema changes. |

## Project structure

```text
src/app/        Next.js routes, layout, and global styles
src/components/ Reusable UI components (reserved for future milestones)
src/db/         Drizzle connection and schema definitions
src/lib/        Shared server-side utilities and environment access
src/schemas/    Zod validation schemas
src/types/      Shared TypeScript types (reserved for future milestones)
scripts/        Command-line project scripts
drizzle/        Versioned SQL migrations and Drizzle migration metadata
tests/unit/     Vitest unit tests
e2e/            Playwright test location
```
