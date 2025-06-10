export default {
    transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest'],
    },
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testEnvironment: 'node',
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    collectCoverageFrom: [
        'src/**/*.{js,ts}',
        '!src/**/*.d.ts',
        '!src/**/*.test.{js,ts}',
        '!tests/**'
    ],
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
    coverageReporters: ['text', 'lcov', 'clover', 'html'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@solana|bip39|bs58|micro-ed25519-hdkey)/)'
    ],

}; 