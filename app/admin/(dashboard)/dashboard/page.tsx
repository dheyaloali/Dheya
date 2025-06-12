import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { AdminDashboardClient } from "@/components/admin/dashboard-client"

export default async function AdminDashboard() {
  // Server-side session check
  const session = await getServerSession(authOptions)
  console.log('SESSION DEBUG:', session)
  if (!session || !session.user?.isAdmin) {
    redirect("/login")
  }
  if (session.user.mfaEnabled === false) {
    redirect("/setup-mfa")
  }

  return <AdminDashboardClient />
}
