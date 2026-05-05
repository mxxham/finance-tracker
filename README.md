# FinTrack — Personal Finance Tracker

A full-stack personal finance app built with **Next.js 15**, **TypeScript**, **Tailwind CSS v4**, **PostgreSQL**, and **JWT auth**.

## Features
- JWT Authentication (register/login, bcrypt passwords)
- Dashboard with income/expense/savings cards + Recharts area & pie charts
- Transactions — full CRUD, filter by month/type/year
- Budgets — set monthly limits per category with visual progress bars
- Categories — custom colors, income vs expense types
- REST API — all routes protected with Bearer token middleware

## Tech Stack
- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Recharts
- **Backend**: Next.js API Routes (REST)
- **Database**: PostgreSQL (via `pg` driver), auto-initializes tables on first run
- **Auth**: JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`)

## Quick Start

### 1. Install
```bash
npm install
```

### 2. Start PostgreSQL
```bash
# Docker (recommended)
docker-compose up -d

# Or create DB manually
createdb finance_tracker
psql finance_tracker < db/schema.sql
```

### 3. Configure
```bash
cp .env.example .env.local
# Edit DATABASE_URL and JWT_SECRET
```

### 4. Run
```bash
npm run dev
# http://localhost:3000
```

## REST API

All protected routes require: `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login, get JWT |
| GET/POST | `/api/transactions` | List/create transactions |
| GET/PUT/DELETE | `/api/transactions/:id` | Single transaction |
| GET/POST | `/api/categories` | List/create categories |
| GET/POST | `/api/budgets` | List/upsert budgets |
| GET | `/api/stats` | Monthly stats + trend data |

## Project Structure
```
app/
  api/              # REST API routes
  dashboard/        # Protected pages (overview, transactions, budgets, categories)
  page.tsx          # Login/Register
components/
  Sidebar.tsx
lib/
  db.ts             # PostgreSQL pool + auto-init
  auth.ts           # JWT helpers
  AuthContext.tsx   # React auth state
  api.ts            # Frontend fetch client
db/schema.sql       # Manual DB setup script
docker-compose.yml  # PostgreSQL dev container
```
