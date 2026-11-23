module.exports = {
    testEnvironment: 'jsdom',
    displayName: {
        name: 'notifly-js-sdk',
        color: 'blue',
    },
    collectCoverage: false,
    setupFiles: ['<rootDir>/test/jest.setup.js'],
    modulePathIgnorePatterns: ['<rootDir>/notifly-kmp-sdk/'],
    testPathIgnorePatterns: ['node_modules/', 'dist/', 'lib/', 'examples/'],
};
