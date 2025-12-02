# Next.js Migration Guide - Turbo Merch v2.0

**Migration Status:** 🚧 In Progress
**From:** Vite + Client-Only App
**To:** Next.js 15 App Router + Full Backend

---

## ✅ What's Been Completed

### 1. **Next.js 15 App Router Structure** ✅
Created the foundational Next.js structure:
- `app/layout.tsx` - Root layout with SEO metadata
- `app/page.tsx` - Home page (currently wraps existing App component)
- `app/globals.css` - Tailwind CSS with custom design system
- `next.config.mjs` - Next.js configuration
- Updated `tsconfig.json` for Next.js

### 2. **Stripe Backend API Routes** ✅
Implemented full Stripe integration:
- `app/api/stripe/create-checkout-session/route.ts` - Checkout session creation
- `app/api/webhooks/stripe/route.ts` - Webhook handler for subscription events

**Features:**
- Secure server-side Stripe API calls
- Subscription creation and management
- Webhook handling for all subscription events
- User metadata tracking

### 3. **Database Schema (Prisma)** ✅
Created comprehensive database schema in `prisma/schema.prisma`:

**Models:**
- `User` - User accounts linked to Clerk
- `Subscription` - Stripe subscription management
- `Listing` - Saved Amazon Merch listings
- `ApiUsage` - API call tracking and rate limiting

### 4. **Updated Dependencies** ✅
Updated `package.json` with Next.js dependencies:
- `next@^15.1.0` - Latest Next.js
- `@clerk/nextjs@^6.8.2` - Clerk for Next.js
- `stripe@^17.5.0` - Stripe SDK
- `@prisma/client@^6.2.0` - Database ORM
- `prisma@^6.2.0` - Prisma CLI

---

## 🚧 What Needs To Be Done

### Phase 1: Complete Migration Setup (REQUIRED)

#### 1. Install New Dependencies
```bash
# Remove old node_modules and package-lock
rm -rf node_modules package-lock.json

# Install Next.js dependencies
npm install

# Generate Prisma client
npx prisma generate
```

#### 2. Set Up Database
You need a PostgreSQL database. Options:

**Option A: Vercel Postgres (Recommended)**
1. Go to Vercel dashboard → Storage → Create Database → Postgres
2. Copy connection strings to environment variables

**Option B: Neon, Supabase, or Railway**
1. Create account and database
2. Copy connection string

**Add to Vercel Environment Variables:**
```
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://...
```

#### 3. Run Database Migrations
```bash
npx prisma migrate dev --name init
```

### Phase 2: Update Components for Next.js

#### 1. Update Environment Variable References
Find and replace in ALL files:
```javascript
// OLD (Vite)
import.meta.env.VITE_API_KEY

// NEW (Next.js)
process.env.NEXT_PUBLIC_API_KEY  // For client components
process.env.API_KEY               // For server components/API routes
```

**Files to Update:**
- `services/geminiService.ts` - Change all `import.meta.env.VITE_*` to `process.env.NEXT_PUBLIC_*`
- `components/TrendScanner.tsx` - Update env var references
- Any other files using `import.meta.env`

#### 2. Update Clerk Imports
```javascript
// OLD
import { ClerkProvider, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";

// NEW
import { useUser } from "@clerk/nextjs";
// ClerkProvider is already in app/layout.tsx
```

#### 3. Make Client Components Explicit
Add `'use client';` to the top of files that use:
- React hooks (useState, useEffect, etc.)
- Browser APIs (localStorage, window, etc.)
- Event handlers

**Files that need `'use client'`:**
- All files in `components/`
- `App.tsx` (or convert to server component)

### Phase 3: Implement Backend Features

#### 1. Create Database Helper Functions
Create `lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### 2. Update Stripe Webhook Handler
In `app/api/webhooks/stripe/route.ts`, replace TODO comments with actual database calls:
```typescript
import { prisma } from '@/lib/db';

// In checkout.session.completed:
await prisma.subscription.create({
  data: {
    userId: user.id,
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: session.subscription as string,
    stripePriceId: session.line_items?.data[0]?.price?.id,
    tier: session.metadata?.tier || 'pro',
    status: 'active',
  }
});
```

#### 3. Create User Sync Webhook
Create `app/api/webhooks/clerk/route.ts` to sync Clerk users to database

#### 4. Update Storage Service
Replace localStorage with database calls:
- Create API routes for CRUD operations
- Update `services/storage.ts` to call API routes instead of localStorage

### Phase 4: SEO & Performance

#### 1. Add Metadata to Pages
Already done in `app/layout.tsx`, but you can enhance:
- Add `metadata` export to individual pages
- Create dynamic OG images
- Add JSON-LD structured data

#### 2. Optimize Images
Replace `<img>` tags with Next.js `<Image>`:
```typescript
import Image from 'next/image';

<Image
  src="/logo.png"
  alt="TurboMerch"
  width={200}
  height={50}
  priority
/>
```

#### 3. Add Sitemap
Create `app/sitemap.ts`:
```typescript
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://turbomerch.ai',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://turbomerch.ai/pricing',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
```

---

## 🔧 Environment Variables Update

### Required Changes in Vercel:

**API Keys - Rename:**
```
OLD: VITE_API_KEY
NEW: NEXT_PUBLIC_API_KEY

OLD: VITE_CLERK_PUBLISHABLE_KEY
NEW: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

OLD: VITE_BRAVE_API_KEY
NEW: NEXT_PUBLIC_BRAVE_API_KEY

OLD: XAI_API_KEY
NEW: NEXT_PUBLIC_GROK_API_KEY
```

**Keep These (Already Correct):**
```
✅ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
✅ NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID
✅ NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
✅ NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID
✅ NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
✅ STRIPE_SECRET_KEY
✅ STRIPE_WEBHOOK_SECRET
✅ CLERK_SECRET_KEY
✅ CLERK_WEBHOOK_SECRET
✅ DATABASE_URL (add after creating database)
✅ DIRECT_DATABASE_URL (add after creating database)
```

---

## 📦 Deployment Steps

### 1. Update Vercel Project Settings
- Framework Preset: Next.js
- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `npm install`

### 2. Environment Variables
- Add all `NEXT_PUBLIC_*` variables
- Add database URLs
- Add Stripe webhook secret

### 3. Deploy
```bash
git add .
git commit -m "feat: Migrate to Next.js 15 with full backend"
git push
```

---

## 🗂️ New File Structure

```
/
├── app/
│   ├── api/
│   │   ├── stripe/
│   │   │   └── create-checkout-session/
│   │   │       └── route.ts
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── prisma/
│   └── schema.prisma
├── components/ (existing)
├── services/ (existing, needs env var updates)
├── lib/
│   └── db.ts (to be created)
├── next.config.mjs
├── tsconfig.json (updated)
└── package.json (updated)
```

---

## ⚠️ Breaking Changes

### 1. **Environment Variables**
All `VITE_*` variables must be renamed to `NEXT_PUBLIC_*`

### 2. **Imports**
- `@clerk/clerk-react` → `@clerk/nextjs`
- Vite-specific imports removed

### 3. **Client/Server Components**
- Must explicitly mark client components with `'use client'`
- Server components are default

### 4. **Routing**
- No more client-side routing with state
- Use Next.js App Router for navigation

---

## 🎯 Benefits of Migration

### Performance ✅
- **Server-Side Rendering** - Faster initial page load
- **Code Splitting** - Automatic, optimized chunks
- **Image Optimization** - Next.js Image component
- **Reduced Client Bundle** - Move logic to server

### SEO ✅
- **Dynamic Meta Tags** - Per-page SEO optimization
- **Server Rendering** - Content visible to crawlers
- **Sitemap Generation** - Automatic sitemap.xml
- **Structured Data** - JSON-LD for rich snippets

### Backend ✅
- **Stripe Integration** - Full subscription management
- **Database** - User data, listings, subscriptions
- **Webhooks** - Event-driven architecture
- **API Routes** - Secure server-side operations

### Security ✅
- **Server-Side API Keys** - Never exposed to client
- **Protected Routes** - Server-side authentication checks
- **CSRF Protection** - Built-in security features

---

## 📋 Migration Checklist

- [x] Create Next.js app structure
- [x] Set up Stripe API routes
- [x] Create Prisma database schema
- [x] Update package.json
- [x] Update tsconfig.json
- [ ] Install dependencies
- [ ] Create PostgreSQL database
- [ ] Run database migrations
- [ ] Update environment variables (VITE_* → NEXT_PUBLIC_*)
- [ ] Update Clerk imports
- [ ] Add 'use client' to components
- [ ] Create lib/db.ts
- [ ] Update webhook handlers with DB calls
- [ ] Test Stripe checkout flow
- [ ] Test subscription webhooks
- [ ] Update Vercel deployment settings
- [ ] Deploy to production

---

## 🆘 Troubleshooting

### Build Errors

**Error: Module not found**
```bash
rm -rf node_modules .next
npm install
```

**Error: Prisma Client not generated**
```bash
npx prisma generate
```

### Database Connection Errors

**Error: Can't reach database**
- Check DATABASE_URL format
- Ensure database is running
- Check firewall settings

### Stripe Webhook Issues

**Error: Webhook signature verification failed**
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- Update STRIPE_WEBHOOK_SECRET with test secret

---

## 📚 Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Clerk Next.js](https://clerk.com/docs/quickstarts/nextjs)

---

## 🚀 Next Steps

1. **Install dependencies**: `npm install`
2. **Set up database**: Create PostgreSQL database on Vercel/Neon
3. **Run migrations**: `npx prisma migrate dev`
4. **Update env vars**: Replace all `VITE_*` with `NEXT_PUBLIC_*`
5. **Test locally**: `npm run dev`
6. **Deploy**: Push to trigger Vercel deployment

**Estimated Time:** 2-4 hours for complete migration

---

**Need Help?** Review the Next.js documentation or reach out for assistance with specific migration steps.
