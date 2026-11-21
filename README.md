# Hospital Management System

Hospital ERP development workspace based on DentalHub. See [implementation status and architecture](docs/hospital-mvp.md) for module coverage and open acceptance work.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4, shadcn/ui (Radix primitives), Framer Motion
- **Database:** PostgreSQL via Prisma ORM 7 (driver adapter: `@prisma/adapter-pg`)
- **Auth:** Custom server-side sessions (bcrypt password hashing, httpOnly cookies, DB-backed `Session` table — fully revocable, no third-party auth library)
- **File storage:** Private clinical files use HOSPITAL_UPLOAD_DIR or .hospital-files, with optional private R2 for documents
- **Data fetching:** Server Components + Server Actions for mutations, TanStack Query for client-interactive surfaces (search, notifications)
- **Forms/validation:** React Hook Form (dynamic line items) + Zod (shared client/server schemas)
- **Charts:** Recharts

## Getting Started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure the database** — set `HOSPITAL_DATABASE_URL` to a PostgreSQL connection string.

3. **Set HOSPITAL_DEMO_PASSWORD in .env to a development-only password of at least 16 characters, then migrate and seed**

   ```bash
   pnpm exec prisma migrate deploy
   pnpm exec prisma db seed
   ```

4. **Start the dev server**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) — the public site is at `/`, the staff app is behind `/login`.


The development administrator is `super_admin@hospital.example`. The doctor is `doctor@hospital.example`. Both use the configured development password.
