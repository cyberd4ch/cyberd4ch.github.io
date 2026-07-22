# cyber.dach — Portfolio

Personal portfolio SPA built with **Next.js 14**, **TypeScript**, and **Tailwind CSS**.

Inspired by [bennett-eghan.com](https://bennett-eghan.com) — monospace, minimal, fast.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- IBM Plex Mono / IBM Plex Sans (Google Fonts)
- Lucide React icons

## Running locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import the repo — Vercel auto-detects Next.js
4. Hit **Deploy** — done in ~60 seconds

No env vars required out of the box.

## Updating content

**Projects** → `lib/projects.ts`  
**Blog posts** → `lib/posts.ts`

Both are plain TypeScript arrays — just edit and push.

## Structure

```
app/
  layout.tsx       ← root layout + nav + footer
  page.tsx         ← home
  projects/page.tsx
  blog/page.tsx
  globals.css      ← design tokens + animations
components/
  Nav.tsx
  Footer.tsx
lib/
  projects.ts      ← project data
  posts.ts         ← blog post data
```
