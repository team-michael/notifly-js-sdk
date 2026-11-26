import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';

const extensions = ['.js', '.ts'];

export default {
    input: 'src/NotiflyServiceWorker.ts',
    output: {
        file: 'dist/NotiflyServiceWorker.js',
        format: 'iife',
    },
    plugins: [
        nodeResolve({ extensions }),
        babel({
            include: 'src/**/*.ts',
            extensions,
            babelHelpers: 'bundled',
            configFile: false,
            babelrc: false,
            presets: [
                ['@babel/preset-env', { targets: { ie: 11 }, loose: true, modules: false }],
                '@babel/preset-typescript',
            ],
        }),
    ],
};
