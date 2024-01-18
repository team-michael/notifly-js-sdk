import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const env = process.env.NODE_ENV;

const extensions = ['.js', '.ts', '.tsx', '.json'];

export default [
    {
        input: 'src/index.ts',
        output: {
            format: 'iife',
            name: 'notifly',
        },
        plugins: [
            nodeResolve({
                extensions,
            }),
            babel({
                include: 'src/**/*',
                exclude: ['src/NotiflyServiceWorker.ts'],
                babelHelpers: 'bundled',
                extensions,
            }),
            replace({
                'process.env.NODE_ENV': JSON.stringify(env),
                preventAssignment: true,
            }),
            commonjs(),
            env === 'production'
                ? terser({
                      compress: {
                          pure_getters: true,
                          unsafe: true,
                          unsafe_comps: true,
                          warnings: false,
                      },
                  })
                : null,
        ].filter(Boolean),
    },
];
