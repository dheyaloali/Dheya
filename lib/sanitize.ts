import { escape } from 'html-escaper'

export const sanitize = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return typeof data === 'string' ? escape(data) : data
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item))
  }

  const sanitized: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = sanitize(value)
  }
  return sanitized
} 