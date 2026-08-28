import { NextResponse, type NextRequest } from "next/server";

import { getHostRoutingDecision } from "./host-routing.rules";

export const proxy = (request: NextRequest): NextResponse => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-maiks-pathname", request.nextUrl.pathname);
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
