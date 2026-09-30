# FormFlow

FormFlow is a focused form builder: create a form, share a public link, and review responses in one dashboard.

## Run locally

Requirements: Git, Docker Desktop, Node.js 22, and pnpm 9.

```powershell
Copy-Item .env.example .env
```

Set a unique `AUTH_SECRET` in `.env`, then start PostgreSQL:

```powershell
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000. The Compose database volume persists across restarts. Stop services with `docker compose down`; remove database data too with `docker compose down -v`.

To run the complete app container locally, use `docker compose up --build -d` after setting `.env`.

## MVP scope

- Account registration and secure sessions
- Form drafts with ordered fields and validation
- Public share links for published forms
- Atomic response submission and response dashboard
- Search/filter and CSV response export

Supported initial fields: short text, long text, email, single choice, and multiple choice.

## Architecture

- `apps/web`: Next.js dashboard, owner API, public form pages, and health check
- `packages/db`: Prisma schema, migrations, and PostgreSQL client
- `packages/validation`: shared form and submission schemas
- `packages/eslint-config`, `packages/typescript-config`: shared workspace config
- PostgreSQL stores users, sessions, forms, fields, submissions, and answers

The first release is a modular web app plus PostgreSQL. There is no background worker until an asynchronous feature requires one.

## Environment variables

See `.env.example`. Keep `.env` and production environment files private and out of Git. Use a strong random `AUTH_SECRET` for every deployment. AWS credentials belong in your local AWS CLI configuration, never in this repository.

## Development commands

- `pnpm dev`: run the web app
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: code quality and production build
- `pnpm db:migrate`: create/apply a development migration
- `pnpm db:deploy`: apply migrations in deployment
- `pnpm db:studio`: inspect the local database

## Deployment

Local Docker Compose and AWS EC2 are intended to use the same application image and database schema. AWS deployment scripts will be added after the core app flow and image publishing are ready. The planned demo topology is one EC2 instance running the web app, PostgreSQL, and Caddy HTTPS proxy, accessed through AWS Systems Manager. Treat this as a portfolio demo; configure database backups before relying on persistent user data.
