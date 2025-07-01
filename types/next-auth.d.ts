import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      isApproved: boolean
      mfaEnabled: boolean
      isAdmin: boolean
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: string
    isApproved: boolean
    mfaEnabled: boolean
  }

  interface JWT {
    id: string
    role: string
    isApproved: boolean
    mfaEnabled: boolean
    isAdmin: boolean
  }
} 