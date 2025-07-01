import { NextRequest, NextResponse } from "next/server";
import { isNativeAppRequest } from "@/lib/auth-guard";

/**
 * Mobile API Gateway
 * 
 * This is a single static endpoint that handles all API requests from the native app
 * and proxies them to the appropriate dynamic routes.
 * 
 * It solves the issue with Capacitor static exports not supporting dynamic routes.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify this is a request from the native app
    if (!isNativeAppRequest(req)) {
      return NextResponse.json({ error: "Unauthorized. This endpoint is only for native app requests." }, { status: 401 });
    }

    // Parse the request body
    const body = await req.json();
    const { path, method = "GET", params = {}, data = null } = body;

    if (!path) {
      return NextResponse.json({ error: "Missing required 'path' parameter" }, { status: 400 });
    }

    // Build the internal request URL
    const url = new URL(path, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
    
    // Add query parameters for GET requests
    if (method === "GET" && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Prepare headers
    const headers = new Headers(req.headers);
    headers.set("x-forwarded-from-mobile-gateway", "true");
    
    // Forward the request to the internal API
    const options = {
      method,
      headers,
      body: method !== "GET" && data ? JSON.stringify(data) : undefined,
    };

    // Make the internal request
    const response = await fetch(url.toString(), options);
    const responseData = await response.json();

    // Return the response from the internal API
    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error("[Mobile Gateway] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Support GET requests for easier testing
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: "Mobile Gateway API is running. Use POST method with path, method, params, and data."
  });
} 