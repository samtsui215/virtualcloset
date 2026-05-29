# Virtual Closet

A web app for digitizing your wardrobe, building outfits, and generating new ones intelligently.

- **Frontend**: Next.js 14 (App Router), React, Tailwind, Zustand
- **Backend**: Next.js API routes (Node), Prisma ORM
- **Database**: PostgreSQL
- **Auth**: NextAuth (Credentials + JWT session)
- **Image storage**: local FS (dev) / Cloudinary (prod), abstracted behind one driver interface
- **Image pipeline**: `sharp` — resize, AVIF/WebP, blur placeholder, dominant-color extraction → auto color-family tag

## Architecture

```
            ┌──────────────────────────────────────────────────┐
            │                  Browser (React)                 │
            │   Closet · Outfit Builder · Generate · Auth UI   │
            └──────────────┬────────────────────────┬──────────┘
                           │ HTTP/JSON              │ <img>
                           ▼                        ▼
            ┌──────────────────────────┐   ┌────────────────────┐
            │  Next.js API routes      │   │  Image CDN          │
            │  /api/items              │   │  (Cloudinary or     │
            │  /api/outfits            │   │   /public/uploads)  │
            │  /api/outfits/generate   │   └────────────────────┘
            │  /api/outfits/feedback   │            ▲
            │  /api/upload             │────────────┘ optimized
            │  /api/auth/[...nextauth] │              (sharp)
            └──────────┬───────────────┘
                       │ Prisma
                       ▼
            ┌──────────────────────────┐
            │   PostgreSQL              │
            │  users · items · outfits  │
            │  outfit_items · wears     │
            │  item_pairings · feedback │
            └──────────────────────────┘
```

The generator is a pure module under `src/lib/outfit/`. It reads from Prisma but has no transport-layer dependency, so it can also be invoked from a future worker, ML reranker, or batch job.

## Folder structure

```
outfitfullstack/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── upload/route.ts
│   │   │   ├── items/route.ts
│   │   │   ├── items/[id]/route.ts
│   │   │   ├── outfits/route.ts
│   │   │   ├── outfits/[id]/route.ts
│   │   │   ├── outfits/generate/route.ts
│   │   │   └── outfits/feedback/route.ts
│   │   ├── closet/page.tsx
│   │   ├── outfits/new/page.tsx
│   │   ├── outfits/generate/page.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ItemUploader.tsx
│   │   ├── ItemCard.tsx
│   │   ├── OutfitBuilder.tsx
│   │   ├── OutfitCard.tsx
│   │   ├── FilterBar.tsx
│   │   └── Nav.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── session.ts
│   │   ├── storage.ts
│   │   ├── images.ts
│   │   └── outfit/
│   │       ├── color.ts
│   │       ├── scoring.ts
│   │       └── generator.ts
│   └── store/
│       └── builderStore.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── SCHEMA.md
├── public/uploads/        (gitignored — local image storage)
├── .env.example
├── next.config.js
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── postcss.config.js
```

## Setup

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET. Cloudinary keys optional in dev.

# 3. DB
npx prisma migrate dev --name init
npx prisma generate

# 4. Run
npm run dev
```

Open http://localhost:3000, register an account, and start uploading items.

## Key reads

- **API**: see [docs/API.md](docs/API.md)
- **Database**: see [docs/SCHEMA.md](docs/SCHEMA.md)
- **Generation algorithm**: see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#outfit-generation) and `src/lib/outfit/generator.ts`
