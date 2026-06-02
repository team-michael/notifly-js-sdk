module.exports = {
    testEnvironment: 'jsdom',
    displayName: {
        name: 'notifly-js-sdk',
        color: 'blue',
    },
    collectCoverage: false,
    setupFiles: ['<rootDir>/test/jest.setup.js'],
    testPathIgnorePatterns: ['node_modules/', 'dist/', 'lib/', 'examples/'],
};
