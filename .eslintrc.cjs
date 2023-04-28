module.exports = {
    root: true,
    env: {
        es6: true,
        jest: true,
        node: true,
        'react-native/react-native': true,
    },
    parser: '@babel/eslint-parser',
    plugins: ['react', 'react-native'],
    extends: ['eslint:recommended', 'plugin:react/recommended'],
    rules: {
        'react/prop-types': 'off',
        'react/react-in-jsx-scope': 'off',
        'no-console': 'off',
        'no-unused-vars': 'warn',
        'react-native/no-unused-styles': 'warn',
        'react-native/split-platform-components': 'warn',
        'react-native/no-inline-styles': 'warn',
        'react-native/no-color-literals': 'warn',
        'react-native/no-raw-text': 'warn',
    },
    settings: {
        react: {
            version: 'detect',
        },
    },
    parserOptions: {
        requireConfigFile: false,
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true,
        },
        babelOptions: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
            plugins: ['@babel/plugin-syntax-import-assertions'],
        },
    },
};
