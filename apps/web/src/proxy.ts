import { NextResponse, type NextRequest } from "next/server";

export const proxy = (request: NextRequest): NextResponse => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-maiks-pathname", request.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
};

