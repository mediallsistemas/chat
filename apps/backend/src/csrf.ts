import { doubleCsrf } from 'csrf-csrf'
import { Request } from 'express'

export const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  getSessionIdentifier: (req: Request) => (req.cookies?.['auth_token'] as string) ?? '',
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
})
