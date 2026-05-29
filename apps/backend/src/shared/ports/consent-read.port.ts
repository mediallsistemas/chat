import { ConsentType } from '@prisma/client'

export const CONSENT_READ_PORT = Symbol('CONSENT_READ_PORT')

export interface ConsentReadPort {
  hasConsent(userId: string, type: ConsentType): Promise<boolean>
}
