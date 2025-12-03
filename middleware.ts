import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/docs',
  '/test-apis', // API testing page
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/research',
  '/api/imagegen',
  '/api/validate',
  '/api/select',
  '/api/listing',
  '/api/artprompt',
  '/api/compliance',
  '/api/packaging',
  '/api/reset-rate-limit',
  '/api/test-apis', // API testing endpoint
  '/api/trend-lab', // Trend Lab search (guest mode support)
  '/api/webhooks/stripe', // Stripe webhooks must be public
]);

export default clerkMiddleware(async (auth, request) => {
  // Protect routes that aren't public
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
