import { NextResponse, type NextRequest } from "next/server";

import { createCanonicalAccessRecoveryPath } from "./app/access/recovery/access-recovery.rules";
import { getHostRoutingDecision } from "./host-routing.rules";

export const proxy = (request: NextRequest): NextResponse => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-maiks-pathname", request.nextUrl.pathname);

  if (request.nextUrl.pathname === "/access/recovery") {
    const canonicalPath = createCanonicalAccessRecoveryPath(request.nextUrl);
    const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

    if (canonicalPath !== currentPath) {
      const redirectUrl = request.nextUrl.clone();
      const [pathname, search = ""] = canonicalPath.split("?");

      redirectUrl.pathname = pathname ?? "/access/recovery";
      redirectUrl.search = search ? `?${search}` : "";

      return NextResponse.redirect(redirectUrl);
    }
  }

  const routingDecision = getHostRoutingDecision({
    hostHeader: request.headers.get("host"),
    pathname: request.nextUrl.pathname
  });

  if (routingDecision.action === "rewrite") {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = routingDecision.pathname;

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders
      }
    });
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
};
