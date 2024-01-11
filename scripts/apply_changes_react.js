const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');
const packageJsonExampleReact = require('../example-react/package.json');

const extractSdkVersionFromExampleReactPackageJson = (depName) => {
    // depName is in form of 'file:../notifly-js-sdk-1.0.0.tgz'
    const version = depName.split('-').pop().split('.tgz')[0];
    return version;
};

const WORKING_DIRECTORY = path.join(__dirname, '..');
const EXAMPLE_REACT_DIRECTORY = path.join(__dirname, '../example-react');
const NPM_PREFIXED_FOR_EXAMPLE_REACT = `npm --prefix ${EXAMPLE_REACT_DIRECTORY}`;

const sdkVersion = packageJson.version;
const sdkPackageName = packageJson.name;

const exampleReactVersion = extractSdkVersionFromExampleReactPackageJson(
    packageJsonExampleReact.dependencies[sdkPackageName]
);
if (sdkVersion !== exampleReactVersion) {
    // Update example-react package.json
    packageJsonExampleReact.dependencies[sdkPackageName] = `file:../${sdkPackageName}-${sdkVersion}.tgz`;
    // Write changes to package.json
    fs.writeFileSync(
        path.join(EXAMPLE_REACT_DIRECTORY, 'package.json'),
        JSON.stringify(packageJsonExampleReact, null, 2) + '\n'
    );
}

function executeCommands(commands) {
    commands.forEach((command) => {
        console.log('----------------------------------------');
        console.log(`Executing: ${command}`);
        console.log('----------------------------------------');

        execSync(command, { stdio: 'inherit' });
    });
}

executeCommands([
    `cd ${WORKING_DIRECTORY}`,
    'rm -rf *.tgz',
    'npm run build',
    'npm pack',
    `${NPM_PREFIXED_FOR_EXAMPLE_REACT} run clean`,
    `${NPM_PREFIXED_FOR_EXAMPLE_REACT} install`,
    `${NPM_PREFIXED_FOR_EXAMPLE_REACT} run start`,
]);
