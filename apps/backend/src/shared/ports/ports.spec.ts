import { CONSENT_READ_PORT, USERS_READ_PORT, UNITS_READ_PORT } from './index'

/**
 * Smoke tests for the port tokens. These must remain unique Symbol instances
 * so NestJS DI can distinguish them. Importing the wrong token would silently
 * resolve to undefined, hence the explicit check.
 */
describe('shared/ports tokens', () => {
  it('every port token is a unique Symbol', () => {
    expect(typeof CONSENT_READ_PORT).toBe('symbol')
    expect(typeof USERS_READ_PORT).toBe('symbol')
    expect(typeof UNITS_READ_PORT).toBe('symbol')

    const all = [CONSENT_READ_PORT, USERS_READ_PORT, UNITS_READ_PORT]
    expect(new Set(all).size).toBe(all.length)
  })

  it('Symbol.for/getId is descriptive (helps debugging DI errors)', () => {
    expect(CONSENT_READ_PORT.description).toBe('CONSENT_READ_PORT')
    expect(USERS_READ_PORT.description).toBe('USERS_READ_PORT')
    expect(UNITS_READ_PORT.description).toBe('UNITS_READ_PORT')
  })
})
