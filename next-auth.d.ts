import NextAuth, { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      isAdmin: boolean
      isApproved: boolean
    } & DefaultSession["user"]
  }
  interface User extends DefaultUser {
    id: string
    isAdmin: boolean
    isApproved: boolean
  }
} 