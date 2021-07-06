const path = require('path');
const {execSync} = require('child_process');
const fs = require('fs');
const {readdirSync, statSync} = require('fs');

const cdkOut = 'cdk.out';
const buildPath = path.join(__dirname, cdkOut);
const dirs = readdirSync(buildPath)
    .filter(f => statSync(path.join(buildPath, f)).isDirectory());

console.log(dirs);

if (dirs.length !== 1) {
    throw new Error('Expected exactly 1 asset directory in the build output');
}
const assetDir = dirs[0];
const hash = assetDir.replace('asset.', '');
const zipName = `${hash}.zip`;
const versionKey = `assets/||${zipName}`;

// Create an output folder with only required output files
const outPath = path.join(__dirname, 'prod');
if (!fs.existsSync(outPath)){
    fs.mkdirSync(outPath);
}
// Copy the production CF template
const prodTemplate = 'OData.template.json';
fs.copyFileSync(path.join(buildPath, prodTemplate), path.join(outPath, prodTemplate));
// Create a txt file with asset parameter values to insert into template
fs.writeFileSync(path.join(outPath, 'asset-values.txt'), `${hash}\n<S3 bucket name>\n${versionKey}`);
// Zip the required assets
const assetPath = path.join(cdkOut, assetDir);
const zipFilename = path.join(outPath, zipName);
const command = `powershell Compress-Archive -Path '${assetPath}\\*.*' -DestinationPath '${zipFilename}' -Force`;
console.log('Zipping files:', command);
execSync(command);

console.log(`Created folder with production deployment assets: ${outPath}`);