# Database Migration Required

## StorageAddon Feature

The recent changes added a new `StorageAddon` model to support paid cloud storage extensions.

### To apply the migration:

```bash
# Option 1: Apply migration manually
psql $DATABASE_URL < prisma/migrations/20250124_add_storage_addons/migration.sql

# Option 2: Let Prisma apply it (recommended)
npx prisma migrate deploy
```

### What this migration adds:

- New `StorageAddon` table for tracking paid storage extensions
- Foreign key relationship to `User` table
- Indexes for performance on userId, status, and periodEnd
- Support for three addon tiers:
  - Extended 6M: +180 days retention ($9.99/mo)
  - Extended 1Y: +365 days retention ($16.99/mo)
  - Unlimited: Never expires ($29.99/mo)

### After applying migration:

```bash
# Regenerate Prisma client
npx prisma generate
```

### Rollback (if needed):

```sql
DROP TABLE "StorageAddon";
```
