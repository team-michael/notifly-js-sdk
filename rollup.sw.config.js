import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
export default {
    input: 'src/NotiflyServiceWorker.ts',
    output: { file: 'dist/NotiflyServiceWorker.js', format: 'iife' },
    plugins: [
        nodeResolve({ extensions: ['.js', '.ts'] }),
        babel({
            babelHelpers: 'bundled',
            extensions: ['.js', '.ts'],
            babelrc: false,
            configFile: false,
            presets: [
                ['@babel/preset-env', { targets: { esmodules: true }, modules: false }],
                '@babel/preset-typescript',
            ],
        }),
    ],
};
