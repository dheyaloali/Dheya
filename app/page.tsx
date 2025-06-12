import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

interface SessionUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  isAdmin: boolean
}

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user as SessionUser

  if (user.isAdmin) {
    redirect("/admin/dashboard")
  } else {
    redirect("/employee/dashboard")
  }
}
