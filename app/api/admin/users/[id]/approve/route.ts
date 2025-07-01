import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    // Check if user is authenticated and is an admin
    if (!session || session.user.role !== "admin") {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const userId = params.id

    // Update user's approval status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isApproved: true },
      include: {
        employee: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error("[USER_APPROVE]", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}