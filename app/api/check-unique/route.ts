import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Handle empty request body
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ 
        available: false, 
        message: "invalidContentType" 
      }, { status: 400 });
    }

    // Get the request body text first to check if it's empty
    const text = await req.text();
    if (!text) {
      return NextResponse.json({ 
        available: false, 
        message: "emptyRequest" 
      }, { status: 400 });
    }

    // Parse the JSON
    let field, value;
    try {
      const body = JSON.parse(text);
      field = body.field;
      value = body.value;
    } catch (error) {
      console.error("JSON parse error:", error);
      return NextResponse.json({ 
        available: false, 
        message: "invalidJSON" 
      }, { status: 400 });
    }
    
    // Validate required fields
    if (!field || !value) {
      return NextResponse.json({ 
        available: false, 
        field, 
        message: "missingFields" 
      }, { status: 400 });
    }
    
    // Trim the input value
    const trimmedValue = typeof value === 'string' ? value.trim() : value;
    
    let existing = null;

    if (field === "email") {
      // Case-insensitive check for email
      existing = await prisma.user.findFirst({
        where: { email: { equals: trimmedValue.toLowerCase(), mode: 'insensitive' } }
      });
      if (existing) return NextResponse.json({ 
        available: false, 
        field, 
        message: "emailTaken" 
      }, { status: 200 });
    } else if (field === "name") {
      // Lowercase for case-insensitive check
      existing = await prisma.user.findFirst({
        where: { name: trimmedValue }
      });
      // If not found, try case-insensitive (for SQLite, you may need to fetch and compare in JS)
      if (!existing) {
        const users = await prisma.user.findMany({ where: { name: { not: undefined } } });
        if (users.some((user: any) => user.name && user.name.toLowerCase() === trimmedValue.toLowerCase())) {
          return NextResponse.json({ 
            available: false, 
            field, 
            message: "nameTaken" 
          }, { status: 200 });
        }
      } else {
        return NextResponse.json({ 
          available: false, 
          field, 
          message: "nameTaken" 
        }, { status: 200 });
      }
    } else {
      return NextResponse.json({ 
        available: true, 
        field, 
        message: "available" 
      }, { status: 200 });
    }
    
    // If we got here, the field is available
    return NextResponse.json({ 
      available: true, 
      field, 
      message: "available" 
    }, { status: 200 });
    
  } catch (error) {
    console.error("Error in check-unique API:", error);
    return NextResponse.json({ 
      available: false, 
      message: "checkFailed" 
    }, { status: 200 }); // Return 200 even on error to avoid breaking the UI
  }
} 