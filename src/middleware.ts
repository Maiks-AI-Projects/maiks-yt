import { NextRequest, NextResponse } from "next/server";
import { VALID_SUBDOMAINS } from "./lib/subdomains";

/**
 * Middleware to handle subdomain routing.
 * 
 * Logic:
 * 1. Extract the subdomain from the 'Host' header.
 * 2. If the subdomain matches one of the hobby keys, rewrite to /[subdomain]/...
 * 3. Support dev.maiks.yt and localhost correctly.
 */

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // Domains to treat as root (no subdomain)
  const rootDomains = ["maiks.yt", "dev.maiks.yt", "www.maiks.yt"];
  
  // Extract subdomain
  let subdomain = "";
  
  // Clean hostname (remove port)
  const cleanHost = hostname.split(":")[0];
  
  if (rootDomains.includes(cleanHost)) {
    subdomain = "";
  } else if (cleanHost.endsWith(".maiks.yt")) {
    subdomain = cleanHost.replace(".maiks.yt", "");
  } else if (cleanHost.endsWith(".dev.maiks.yt")) {
    subdomain = cleanHost.replace(".dev.maiks.yt", "");
  } else if (cleanHost.endsWith(".localhost") || cleanHost === "localhost") {
    // Support local development with subdomains like mc.localhost
    if (cleanHost.includes(".")) {
      subdomain = cleanHost.split(".")[0];
    }
  }

  // Handle 'www' or empty subdomain
  if (!subdomain || subdomain === "www") {
    return NextResponse.next();
  }

  // If the subdomain is one of our hobby keys, rewrite to the dynamic route
  if (VALID_SUBDOMAINS.includes(subdomain)) {
    // Avoid double rewriting if the path already starts with the subdomain
    // This can happen if a user manually navigates to /mc/...
    if (url.pathname.startsWith(`/${subdomain}`)) {
      return NextResponse.next();
    }

    return NextResponse.rewrite(
      new URL(`/${subdomain}${url.pathname}${url.search}`, request.url)
    );
  }

  // Fallback for other subdomains: treat as root
  return NextResponse.next();
}
