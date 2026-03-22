import { NextRequest } from 'next/server';

/**
 * Validate API authentication.
 * - If API_TOKEN env is not set, allow all requests (dev mode)
 * - If requireAuth=false, allow unauthenticated GET requests
 * - Write operations (POST/PUT/PATCH) should use requireAuth=true
 */
export function validateAuth(req: NextRequest, requireAuth = false): boolean {
  const apiToken = process.env.API_TOKEN;
  if (!apiToken) return true; // dev mode — no token configured

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7) === apiToken;
  }

  return !requireAuth; // allow unauthenticated if not required
}
