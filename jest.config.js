/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  globalTeardown: '<rootDir>/src/tests/teardown.js',
  clearMocks: true,
  testTimeout: 180000,
};
