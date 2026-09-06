import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';

const extensions = ['.js', '.ts', '.tsx', '.json'];
const runtimeDependencies = ['lodash', 'notifly-web-message-renderer', 'uuid'];

function isRuntimeDependency(id) {
    return runtimeDependencies.some((dependency) => id === dependency || id.startsWith(`${dependency}/`));
}

function createModuleConfig(format, file) {
    return {
        input: 'src/index.ts',
        external: isRuntimeDependency,
        output: {
            file,
            format,
            sourcemap: true,
            exports: 'named',
        },
        plugins: [
            nodeResolve({ extensions }),
            commonjs(),
            babel({
                include: 'src/**/*',
                exclude: ['src/NotiflyServiceWorker.ts'],
                babelHelpers: 'bundled',
                extensions,
            }),
        ],
    };
}

export default [createModuleConfig('cjs', 'lib/cjs/index.js'), createModuleConfig('esm', 'lib/esm/index.js')];
