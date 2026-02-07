import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import MaximumSecurity from './lib/enhanced-security'

// Advanced rate limiting for high traffic protection (keeping existing for backward compatibility)
const rateLimitMap = new Map<string, { count: number; lastReset: number; penalties: number }>();
const slowClientsMap = new Map<string, number>(); // Track slow clients
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // Increased for normal traffic
const MAX_REQUESTS_BURST = 20; // Burst protection
const SLOW_CLIENT_THRESHOLD = 5000; // 5 seconds for slow responses
const PENALTY_MULTIPLIER = 0.5; // Reduce limits for repeat offenders
const MIN_REQUESTS_PER_WINDOW = 10; // Always allow a small baseline

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const userRate = rateLimitMap.get(ip);

  if (!userRate) {
    rateLimitMap.set(ip, { count: 1, lastReset: now, penalties: 0 });
    return false;
  }

  // Reset if window has passed
  if (now - userRate.lastReset > RATE_LIMIT_WINDOW) {
    // Log if penalties exist (for monitoring)
    if (userRate.penalties > 0) {
      console.info(`[RATE-LIMIT] IP ${ip} window reset - Previous penalties: ${userRate.penalties}`);
    }
    rateLimitMap.set(ip, { count: 1, lastReset: now, penalties: userRate.penalties });
    return false;
  }

  // Calculate effective limit based on penalties
  const effectiveLimit = Math.max(
    MIN_REQUESTS_PER_WINDOW,
    Math.floor(MAX_REQUESTS_PER_WINDOW * (1 - (userRate.penalties * PENALTY_MULTIPLIER)))
  );

  // Burst protection - check last 10 seconds
  const recentWindow = 10 * 1000;
  if (userRate.count > MAX_REQUESTS_BURST && (now - userRate.lastReset) < recentWindow) {
    userRate.penalties++;
    console.warn(`[RATE-LIMIT] Burst protection triggered for IP ${ip} - Count: ${userRate.count}, Penalties: ${userRate.penalties}`);
    return true;
  }

  // Check if limit exceeded
  if (userRate.count >= effectiveLimit) {
    userRate.penalties++;
    console.warn(`[RATE-LIMIT] Limit exceeded for IP ${ip} - Count: ${userRate.count}, Effective Limit: ${effectiveLimit}, Penalties: ${userRate.penalties}`);
    return true;
  }

  // Increment count
  userRate.count++;

  // Warning when approaching limit
  if (userRate.count >= effectiveLimit * 0.8) {
    console.info(`[RATE-LIMIT] IP ${ip} approaching limit - Count: ${userRate.count}/${effectiveLimit}`);
  }

  return false;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get('x-real-ip');
  return realIp?.trim() || 'unknown';
}

function isInstagramInAppBrowserServer(userAgent: string | null): boolean {
  if (userAgent) {
    // Common patterns for Instagram's in-app browser user agent string
    return /instagram/i.test(userAgent) || /mozilla\/5\.0 \([^)]+\) applewebkit\/[^ ]+ \(khtml, like gecko\) mobile\/[^ ]+ instagram/i.test(userAgent);
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const middlewareStart = Date.now();
  const { pathname, searchParams, origin } = request.nextUrl;
  const userAgent = request.headers.get('user-agent');
  const adminSession = request.cookies.get('admin_session')?.value;

  // Apply enhanced maximum security ONLY to API routes (not pages/assets)
  if (pathname.startsWith('/api/')) {
    // Enhanced security check with DDoS protection, IP reputation, etc.
    const securityCheck = await MaximumSecurity.secureRequest(request);
    if (securityCheck) return securityCheck;

    // Legacy rate limiting (kept for additional protection)
    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      // Log rate limit violation for monitoring
      console.warn(`[RATE-LIMIT] IP ${ip} exceeded rate limit on ${pathname}`);
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 
          'X-Security-Block': 'legacy-rate-limit',
          'Retry-After': '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0'
        } }
      );
    }
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!adminSession) {
      const loginUrl = new URL('/admin/login', origin);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For Server Actions and API routes, fix headers and continue
  if (pathname.startsWith('/api/') || request.method === 'POST') {
    const response = NextResponse.next();

    // Fix CORS and header issues for Replit
    const forwardedHost = request.headers.get('x-forwarded-host');
    const requestOrigin = request.headers.get('origin');

    if (forwardedHost && forwardedHost.includes('replit.dev')) {
      // For Server Actions, ensure consistent host/origin headers
      if (request.method === 'POST' && pathname.startsWith('/maya-chat')) {
        // Extract hostname without protocol from forwardedHost
        const hostWithoutProtocol = forwardedHost.replace(/^https?:\/\//, '');

        // Set consistent headers - remove port from both if present
        response.headers.set('x-forwarded-host', hostWithoutProtocol);
        response.headers.set('host', hostWithoutProtocol);

        // Also set origin to match
        response.headers.set('origin', `https://${hostWithoutProtocol}`);
      }

      response.headers.set('Access-Control-Allow-Origin', `https://${forwardedHost}`);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Forwarded-Host, X-Forwarded-Proto, X-Forwarded-For, Host, Origin, X-CSRF-Token');
    }

    // Enhanced security headers
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if ((request.headers.get('x-forwarded-proto') || request.nextUrl.protocol) === 'https:') {
      response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // Add caching headers for static assets
    if (request.nextUrl.pathname.startsWith('/_next/static/') || 
        request.nextUrl.pathname.includes('.')) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // No cache for dynamic content (prevents stale data attacks)
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      response.headers.set('Pragma', 'no-cache');
    }

    // Add performance timing headers
    response.headers.set('Server-Timing', `middleware;dur=${Date.now() - middlewareStart}`);

    return response;
  }

  // Check if our redirect trick has already been attempted for this request flow
  const hasRedirectAttemptedFlag = searchParams.has('external_redirect_attempted');

  // Only apply the trick if it's an Instagram browser, the flag isn't set, and it's not an API/static asset path
  if (isInstagramInAppBrowserServer(userAgent) && !hasRedirectAttemptedFlag) {

    // More robustly ignore common asset paths and API routes
    if (pathname.startsWith('/_next/') || 
        pathname.startsWith('/api/') || 
        pathname.startsWith('/media/') || // Assuming /media/ for local assets like audio
        pathname.includes('.') // General check for file extensions like .png, .ico, .css, .js
       ) {
      return NextResponse.next();
    }

    // Construct the target URL for the meta-refresh, preserving original path and query params,
    // and adding our flag.
    const targetUrl = new URL(pathname, origin);
    // Append existing search params
    searchParams.forEach((value, key) => {
        if (key !== 'external_redirect_attempted') { // Avoid duplicating our flag
            targetUrl.searchParams.append(key, value);
        }
    });
    targetUrl.searchParams.set('external_redirect_attempted', 'true');
    const targetUrlString = targetUrl.toString();

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Opening in Browser...</title>
    <meta http-equiv="refresh" content="0;url=${targetUrlString}">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; margin: 0; padding: 25px; background-color: #fafafa; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 90vh; text-align: center; color: #262626; }
        .container { background-color: #ffffff; padding: 20px 30px; border-radius: 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); max-width: 400px; width: 90%; }
        p { margin-bottom: 18px; font-size: 17px; line-height: 1.65; }
        a { color: #0095f6; text-decoration: none; font-weight: 600; }
        a:hover { text-decoration: underline; }
        .loader { border: 4px solid #dbdbdb; border-top: 4px solid #0095f6; border-radius: 50%; width: 35px; height: 35px; animation: spin 1.2s linear infinite; margin: 25px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .small-text { font-size: 13px; color: #8e8e8e; margin-top: 25px; }
    </style>
</head>
<body>
    <div class="container">
        <p>Taking you to the full experience...</p>
        <div class="loader"></div>
        <p>If you're not redirected, please <a href="${targetUrlString}">click here</a>.</p>
        <p class="small-text">This helps ensure all features work correctly by using your phone's main browser.</p>
    </div>
    <script type="text/javascript">
      // The meta refresh is the primary method.
      // A direct window.location.href might be too quick and less likely to trigger OS intervention.
      // No additional JS needed for this specific trick; meta-refresh + Content-Disposition is the core.
    </script>
</body>
</html>`;

    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="open-maya-chat.html"`, // Filename hints to browser/OS
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  }

  // Apply performance headers to all other requests
  const response = NextResponse.next();

  // Add comprehensive Helmet.js-style security headers (SEO-friendly)
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');

  // Additional Helmet.js style headers
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // Only add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Allow indexing in production for SEO
  // Only block in development if explicitly needed
  if (process.env.NODE_ENV !== 'production' && process.env.BLOCK_INDEXING === 'true') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  // Add caching headers for static assets
  if (request.nextUrl.pathname.startsWith('/_next/static/') || 
      request.nextUrl.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (!pathname.startsWith('/api') && !pathname.startsWith('/admin')) {
    // Cache public pages for 1 hour for better SEO
    response.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  }

  // Add performance timing headers
  response.headers.set('Server-Timing', `middleware;dur=${Date.now() - middlewareStart}`);

  return response;
}

// Configure the matcher to run on page routes and API routes for header fixes
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
