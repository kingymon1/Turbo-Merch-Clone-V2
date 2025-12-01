-- Manual SQL fix for overage calculation bug
-- This script corrects usage records where overage doesn't match (designsUsed - allowance)

-- For Starter tier (15 designs allowance, max 10 overage):
-- If user has 24 designs used, overage should be 9, not 10

UPDATE "UsageTracking"
SET
  "overageDesigns" = GREATEST(0, "designsUsedInPeriod" - "designsAllowance"),
  "overageCharge" = GREATEST(0, "designsUsedInPeriod" - "designsAllowance") * 2.00, -- $2 per overage for starter
  "hardCapReached" = false -- Reset hard cap if overage is now under limit
WHERE
  "overageDesigns" != GREATEST(0, "designsUsedInPeriod" - "designsAllowance")
  AND "billingPeriodEnd" >= NOW(); -- Only current billing periods

-- Show affected records
SELECT
  u.email,
  u."subscriptionTier",
  ut."designsUsedInPeriod",
  ut."designsAllowance",
  ut."overageDesigns" as "correctedOverage",
  ut."hardCapReached"
FROM "UsageTracking" ut
JOIN "User" u ON u.id = ut."userId"
WHERE ut."billingPeriodEnd" >= NOW()
ORDER BY ut."designsUsedInPeriod" DESC;
