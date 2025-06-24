export default {
  globalSetup: process.env.SKIP_SETUP ? undefined : './tests/jest.setup.js',
  globalTeardown: process.env.SKIP_TEARDOWN ? undefined : './tests/jest.teardown.js',
  testEnvironment: 'node',
  testTimeout: 30000
}
