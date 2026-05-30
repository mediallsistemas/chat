/**
 * Unit test config. E2E uses test/jest-e2e.json.
 *
 * Picks up *.spec.ts beside source files. Maps @mediall workspace packages
 * to their compiled output via the moduleNameMapper.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@mediall/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@mediall/events$': '<rootDir>/../../../packages/events/src/index.ts',
    '^@mediall/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
}
