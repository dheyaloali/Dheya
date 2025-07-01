import { validateSession } from './validate-session';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Higher-order function that wraps API route handlers with session validation
 * If the session is invalid, returns a 401 Unauthorized response
 * If valid, adds the validated session to the request and calls the handler
 */
export function withValidatedSession(handler: Function) {
  return async (req: NextRequest, context?: any) => {
    try {
      const session = await validateSession(req, context);
      
      if (!session) {
        return NextResponse.json({ 
          error: "Unauthorized", 
          code: "SESSION_INVALID",
          message: "Your session is invalid or has expired. Please log in again."
        }, { 
          status: 401
        });
      }
      
      // Create a new context with the validated session
      const enhancedContext = {
        ...context,
        validatedSession: session
      };
      
      // Call the original handler with the validated session
      return handler(req, enhancedContext);
    } catch (error) {
      console.error("[API] Error in withValidatedSession:", error);
      return NextResponse.json({ 
        error: "Internal Server Error",
        message: "An unexpected error occurred while validating your session."
      }, { 
        status: 500 
      });
    }
  };
} 