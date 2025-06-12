import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// Extend the session type to include isAdmin
interface SessionWithAdmin {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin?: boolean;
  };
}

export async function requireAuth(_request: Request, requireAdmin = false) {
  // Always get session from server per request
  const session = (await getServerSession(authOptions)) as SessionWithAdmin | null;

  if (!session) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  if (requireAdmin && !session.user?.isAdmin) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  return { ok: true, session };
} 