/**
 * Standardised API response helpers.
 *
 * Every API route in this project MUST use these helpers so that all
 * clients can rely on a consistent response envelope:
 *
 *   Success (read)    → { data: T }          HTTP 200
 *   Success (create)  → { data: T }          HTTP 201
 *   Success (delete)  → { success: true }    HTTP 200
 *   Error             → { error: string }    HTTP 4xx / 5xx
 *
 * Frontend usage:
 *   const json = await res.json();
 *   if (!res.ok) { handleError(json.error); return; }
 *   doSomethingWith(json.data);   // for reads / mutations
 *   // or just check res.ok for deletes
 */

import { NextResponse } from "next/server";

/** 200 success — wraps data in { data: T } */
export function ok<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 200 });
}

/** 201 created — wraps data in { data: T } */
export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 });
}

/** 200 success with no payload — used for DELETE */
export function deleted(): NextResponse {
  return NextResponse.json({ success: true }, { status: 200 });
}

/** Error response — always { error: string } */
export function err(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Convenience: 400 Bad Request */
export function badRequest(message: string): NextResponse {
  return err(message, 400);
}

/** Convenience: 401 Unauthorized */
export function unauthorized(): NextResponse {
  return err("Unauthorized", 401);
}

/** Convenience: 403 Forbidden */
export function forbidden(): NextResponse {
  return err("Forbidden", 403);
}

/** Convenience: 404 Not Found */
export function notFound(resource = "Resource"): NextResponse {
  return err(`${resource} not found`, 404);
}
