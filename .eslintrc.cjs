module.exports = {
    root: true,
    env: {
        es6: true,
        jest: true,
        browser: true,
        node: true,
    },
    parser: '@babel/eslint-parser',
    plugins: ['react'],
    extends: ['eslint:recommended', 'plugin:react/recommended'],
    rules: {
        'react/prop-types': 'off',
        'react/react-in-jsx-scope': 'off',
        'no-console': 'off',
        'no-unused-vars': 'warn',
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
