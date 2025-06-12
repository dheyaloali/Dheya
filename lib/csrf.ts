import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export const csrf = async (req: NextRequest) => {
  const token = await getToken({ req })
  if (!token) {
    throw new Error('No CSRF token found')
  }

  const csrfToken = req.headers.get('x-csrf-token')
  if (!csrfToken || csrfToken !== token.csrfToken) {
    throw new Error('Invalid CSRF token')
  }
} 