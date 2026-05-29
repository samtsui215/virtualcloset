# Deploying Virtual Closet (Vercel + Supabase + Firebase Auth)

This app uses three services:

| Concern | Service | Notes |
|---|---|---|
| Hosting | **Vercel** | Next.js, serverless functions |
| Database + image storage | **Supabase** | Postgres (via Prisma) + Storage bucket |
| Authentication | **Firebase Auth** | Email/password + Google |

Supabase is used *only* as a database and file store — not for auth. Firebase owns identity; our API routes authorize every query by `userId`.

---

## 1. Supabase

1. Create a project at supabase.com. Pick a strong DB password.
2. **Connection strings** — Project Settings → Database → Connection string:
   - `DATABASE_URL` = the **Transaction pooler** URL (port `6543`). Append `?pgbouncer=true`.
   - `DIRECT_URL` = the **direct** URL (port `5432`). Used only for migrations.
3. **API keys** — Project Settings → API:
   - `SUPABASE_URL` = the Project URL (`https://<ref>.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` secret (server-only!)
4. **Storage bucket** — Storage → New bucket:
   - Name it `wardrobe`. Mark it **Public** (image URLs are content-hashed and unguessable; switch to signed URLs later if you want them private).

## 2. Firebase Auth

1. Create a project at console.firebase.google.com.
2. **Authentication → Sign-in method** → enable **Email/Password** and **Google**.
3. **Web config** — Project Settings → General → Your apps → add a Web app. Copy the config into the `NEXT_PUBLIC_FIREBASE_*` vars.
4. **Admin credentials** — Project Settings → Service accounts → *Generate new private key*. From the downloaded JSON:
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key` (keep the literal `\n` sequences)
5. **Authorized domains** — Authentication → Settings → Authorized domains: add your Vercel domain (e.g. `your-app.vercel.app`) so Google sign-in works in prod. `localhost` is already allowed.

## 3. Local setup

```bash
cp .env.example .env.local      # fill in all values from steps 1–2
cp .env.local .env              # Prisma CLI reads .env (only needs DATABASE_URL + DIRECT_URL)

npm install
npx prisma migrate dev --name firebase_supabase   # runs against Supabase via DIRECT_URL
npm run dev
```

Set `STORAGE_DRIVER=local` in `.env.local` if you'd rather keep dev images on disk; use `supabase` to exercise the real bucket.

## 4. Deploy to Vercel

```bash
git init && git add -A && git commit -m "Virtual Closet"
gh repo create virtual-closet --private --source=. --push   # or push to an existing remote
```

Then on vercel.com:
1. **Add New → Project** → import the GitHub repo.
2. **Environment Variables** → paste every var from `.env.local` **except** swap `STORAGE_DRIVER=supabase`. (Vercel's filesystem is ephemeral, so `local` won't work in prod.)
   - For `FIREBASE_PRIVATE_KEY`, paste the value with `\n` escapes intact.
3. **Deploy.** The build runs `prisma generate && next build` (already in `package.json`).

### Migrations against Supabase

Vercel's build does **not** run migrations (it only generates the client). Apply schema changes from your machine:

```bash
npx prisma migrate deploy        # uses DIRECT_URL from .env
```

Run this whenever you change `schema.prisma`, before/after deploying.

---

## Troubleshooting

- **`P1001` / connection timeouts on Vercel** → you used the direct URL for `DATABASE_URL`. Runtime must use the **pooler** (6543, `?pgbouncer=true`); only `DIRECT_URL` uses 5432.
- **Google sign-in popup closes with an error in prod** → the Vercel domain isn't in Firebase Authorized domains (step 2.5).
- **`createSessionCookie` fails with "recent sign in required"** → the client must send a freshly-issued ID token; we already force-refresh via `getIdToken(true)`.
- **Images 404 in prod** → `STORAGE_DRIVER` is still `local` on Vercel, or the bucket isn't public.
