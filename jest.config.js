export default {
    globalSetup: process.env.SKIP_SETUP ? undefined : './tests/integration/jest.setup.js',
    globalTeardown: process.env.SKIP_TEARDOWN ? undefined : './tests/integration/jest.teardown.js',
    testEnvironment: 'node',
    testTimeout: 30_000
}