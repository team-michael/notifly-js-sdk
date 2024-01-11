import type { Config } from '@jest/types';

// @ts-check

const config: Config.InitialOptions = {
    testEnvironment: 'jsdom',
    displayName: {
        name: 'notifly-js-sdk',
        color: 'blue',
    },
    collectCoverage: false,
    testPathIgnorePatterns: ['node_modules/', 'dist/', 'lib/', 'example-react/', 'example-vanillajs/'],
};

export default config;
