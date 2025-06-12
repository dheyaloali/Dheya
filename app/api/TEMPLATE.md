# Secure API Route Template

All new API (ABI) routes **must** follow this pattern for authentication, role checks, and error handling.

---

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
// import { PrismaClient } from "@prisma/client"; // Uncomment if you need DB access

// const prisma = new PrismaClient(); // Uncomment if you need DB access

// Example: Only allow admins (set to false for any logged-in user)
const ADMIN_ONLY = true;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, ADMIN_ONLY);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  // const session = auth.session!; // Use session if you need user info

  // --- Your logic here ---
  // Example: return NextResponse.json({ message: "Secure data" });

  return NextResponse.json({ message: "Secure GET endpoint" });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ADMIN_ONLY);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  // const session = auth.session!;

  // --- Your logic here ---
  // const data = await req.json();
  // Example: return NextResponse.json({ message: "Created!" });

  return NextResponse.json({ message: "Secure POST endpoint" });
}

// Add PUT, DELETE, etc. as needed, always starting with the requireAuth check!
```

---

## How to Use This Template

- **Always import and use `requireAuth` at the top of every handler.**
- **Set `ADMIN_ONLY` to `true`** for admin-only endpoints, or `false`/omit for any logged-in user.
- **Access the user/session with `auth.session!`** if you need user info.
- **Return errors with `NextResponse.json({ error: ... }, { status: ... })`** for consistency.

---

## Why This Matters
- **Security:** No endpoint is left unprotected.
- **Consistency:** All devs follow the same pattern.
- **Scalability:** Easy to add new roles or checks in one place (`requireAuth`). 