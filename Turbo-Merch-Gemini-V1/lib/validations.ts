/**
 * Zod Validation Schemas for API Routes
 *
 * Centralized validation schemas to ensure consistent input validation
 * across all API endpoints. Using Zod provides type-safe validation
 * with automatic TypeScript type inference.
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * Valid subscription tier names
 */
export const TierSchema = z.enum([
  'free',
  'starter',
  'pro',
  'business',
  'enterprise',
]);

export type Tier = z.infer<typeof TierSchema>;

/**
 * Valid subscription statuses
 */
export const SubscriptionStatusSchema = z.enum([
  'active',
  'cancelled',
  'past_due',
  'trialing',
]);

// ============================================================================
// DESIGN SCHEMAS
// ============================================================================

/**
 * Schema for tracking design generation
 * POST /api/designs/track
 */
export const TrackDesignSchema = z.object({
  designCount: z
    .number()
    .int()
    .min(1, 'Design count must be at least 1')
    .max(10, 'Design count cannot exceed 10')
    .default(1),
  idempotencyKey: z
    .string()
    .uuid('Idempotency key must be a valid UUID')
    .optional(),
});

export type TrackDesignInput = z.infer<typeof TrackDesignSchema>;

/**
 * Schema for checking design quota
 * POST /api/designs/check-quota
 */
export const CheckQuotaSchema = z.object({
  designCount: z
    .number()
    .int()
    .min(1, 'Design count must be at least 1')
    .max(10, 'Design count cannot exceed 10')
    .default(1),
});

export type CheckQuotaInput = z.infer<typeof CheckQuotaSchema>;

/**
 * Schema for creating a new design
 * POST /api/designs
 */
export const CreateDesignSchema = z.object({
  runId: z.string().uuid('Run ID must be a valid UUID'),
  niche: z.string().min(1, 'Niche is required').max(200, 'Niche is too long'),
  slogan: z.string().max(500, 'Slogan is too long').optional(),
  designCount: z.number().int().min(1).max(10).default(1),
  targetMarket: z.string().min(1, 'Target market is required').max(100),
  listingData: z.record(z.string(), z.unknown()),
  artPrompt: z.record(z.string(), z.unknown()),
  imageUrl: z.string().url('Image URL must be valid').optional(),
  imageQuality: z.enum(['low', 'standard', 'high']).default('standard'),
  canDownload: z.boolean().default(true),
  csvData: z.record(z.string(), z.unknown()).optional(),
  zipUrl: z.string().url('ZIP URL must be valid').optional(),
  wasOverage: z.boolean().default(false),
  chargeAmount: z.number().min(0).optional(),
  runConfig: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export type CreateDesignInput = z.infer<typeof CreateDesignSchema>;

/**
 * Schema for design export
 * POST /api/designs/export
 */
export const ExportDesignSchema = z.object({
  designIds: z
    .array(z.string().cuid('Design ID must be a valid CUID'))
    .min(1, 'At least one design ID is required')
    .max(50, 'Cannot export more than 50 designs at once'),
  format: z.enum(['zip', 'csv', 'json']).default('zip'),
});

export type ExportDesignInput = z.infer<typeof ExportDesignSchema>;

// ============================================================================
// STRIPE SCHEMAS
// ============================================================================

/**
 * Schema for creating a checkout session
 * POST /api/stripe/create-checkout-session
 */
export const CreateCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  tier: TierSchema.optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for Brave search
 * POST /api/brave-search
 */
export const BraveSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(500, 'Search query is too long'),
  count: z.number().int().min(1).max(50).default(10),
  freshness: z.enum(['pd', 'pw', 'pm', 'py']).optional(),
});

export type BraveSearchInput = z.infer<typeof BraveSearchSchema>;

/**
 * Schema for Grok analysis
 * POST /api/grok
 */
export const GrokAnalysisSchema = z.object({
  topic: z
    .string()
    .min(1, 'Topic is required')
    .max(500, 'Topic is too long'),
  context: z.string().max(2000, 'Context is too long').optional(),
});

export type GrokAnalysisInput = z.infer<typeof GrokAnalysisSchema>;

// ============================================================================
// USER SCHEMAS
// ============================================================================

/**
 * Schema for syncing user with Stripe
 * POST /api/user/sync-stripe
 */
export const SyncStripeSchema = z.object({
  forceSync: z.boolean().default(false),
});

export type SyncStripeInput = z.infer<typeof SyncStripeSchema>;

// ============================================================================
// STORAGE ADDON SCHEMAS
// ============================================================================

/**
 * Schema for creating storage addon
 * POST /api/storage-addons
 */
export const CreateStorageAddonSchema = z.object({
  addonType: z.enum(['extended_retention', 'unlimited_storage']).default('extended_retention'),
  stripePriceId: z.string().min(1, 'Stripe price ID is required'),
});

export type CreateStorageAddonInput = z.infer<typeof CreateStorageAddonSchema>;

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Formats Zod error into a readable string
 * Compatible with both Zod v3 and v4
 */
function formatZodError(error: z.ZodError): string {
  // Zod v4 uses issues, Zod v3 uses errors
  const issues = error.issues || (error as any).errors || [];

  if (issues.length === 0) {
    return error.message || 'Validation failed';
  }

  return issues
    .map((issue: any) => {
      const path = issue.path?.join('.') || '';
      const message = issue.message || 'Invalid value';
      return path ? `${path}: ${message}` : message;
    })
    .join(', ');
}

/**
 * Validates request body against a Zod schema
 * Returns parsed data or throws a formatted error
 *
 * @param schema - Zod schema to validate against
 * @param data - Request body to validate
 * @returns Parsed and validated data
 * @throws Error with formatted validation message
 *
 * @example
 * const body = await request.json();
 * const validated = validateRequest(TrackDesignSchema, body);
 */
export function validateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errorMessage = formatZodError(result.error);
    throw new Error(`Validation failed: ${errorMessage}`);
  }

  return result.data;
}

/**
 * Validates request body and returns result object (non-throwing version)
 *
 * @param schema - Zod schema to validate against
 * @param data - Request body to validate
 * @returns Object with success status and either data or error
 *
 * @example
 * const result = safeValidateRequest(TrackDesignSchema, body);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * const { designCount } = result.data;
 */
export function safeValidateRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errorMessage = formatZodError(result.error);
    return { success: false, error: errorMessage };
  }

  return { success: true, data: result.data };
}
