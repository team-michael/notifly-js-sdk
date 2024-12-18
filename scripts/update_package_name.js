const fs = require('fs');

const newName = process.argv[2];
if (!newName) {
  console.error('Error: Package name is required.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync('../package.json', 'utf-8'));
packageJson.name = newName;

fs.writeFileSync('../package.json', JSON.stringify(packageJson, null, 2) + '\n');
console.log(`Updated package name to "${newName}"`);
