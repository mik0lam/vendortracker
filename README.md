# Pokemon Vendor Tracker

Local-first web app for a shared-pool Pokemon singles / graded card business. Track inventory, sales, expenses, partner contributions, monthly P&L, and 50/50 settlement — with CSV export for taxes.

## Requirements

- Node.js 20+ (22 recommended)
- npm

## Setup

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default partners are seeded as **Michael** and **Dillon** (50/50). You can rename them under **Contributions** if needed.

## Day-to-day use

1. **Buy a card** → Inventory → Add purchase (cost, raw condition or grade/cert)
2. **At a card show** → Show buys → Start show day → log who paid and shared vs collection
3. **Sell a card** → Inventory or Sales → Record sale (price, fees, shipping)
4. **Put money in / take money out** → Contributions
5. **Business costs** → Expenses (grading, supplies, show fees, etc.)
6. **Month end** → Reports → review P&L + settlement → export CSV

## Profit math

```
net profit = sale price − purchase cost − platform fees − shipping
```

Partner settlement uses each partner’s split (default 50%):

- Credits: capital contributed + share of net profit
- Debits: share of expenses + withdrawals
- Settlement message tells you who owes whom to even up

## Database & backups

SQLite file location:

```
prisma/dev.db
```

To back up: stop the app (or copy while closed if possible) and copy `prisma/dev.db` somewhere safe (cloud drive, USB, etc.).

To restore: replace `prisma/dev.db` with your backup, then run `npm run dev` again.

Useful commands:

```bash
npm run db:migrate   # apply schema changes
npm run db:seed      # seed partners if empty
npx prisma studio    # browse/edit data in a GUI
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run db:seed` | Seed default partners |

## Accounts and cloud access

Supabase authentication is implemented. Until the Supabase environment
variables are present, authentication is bypassed in local development so the
app remains usable.

To activate accounts:

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the project URL and publishable key.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. In **Authentication → URL Configuration**, add
   `http://localhost:3000/auth/callback` as a redirect URL.
5. Restart `npm run dev`, open `/login`, and sign up.

Anyone can create an account. Each account has its own private workspace —
inventory, sales, trades, expenses, and partners are all scoped to the
signed-in account.

For access outside your home network, the remaining deployment step is:

1. Move the SQLite data to Supabase Postgres.
2. Add the pooled and direct database connection strings to Vercel.
3. Deploy the Next.js app to Vercel and add its URL to Supabase Auth redirects.

Do not deploy with SQLite: Vercel's filesystem is not persistent.

## Tech stack

- Next.js (App Router) + TypeScript
- Prisma + SQLite (`better-sqlite3` adapter)
- Tailwind CSS
