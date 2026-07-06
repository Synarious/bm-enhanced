// Import necessary modules
const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');
const { ESLint } = require('eslint');
const terser = require('terser');

function validateJavaScript(code, label, filePath = label) {
  try {
    new vm.Script(code, { filename: filePath });
    console.log(`  - ✅ ${label} syntax check passed.`);
  } catch (err) {
    const error = new Error(`Syntax validation failed for ${label}: ${err.message}`);
    error.cause = err;
    throw error;
  }
}

async function runLint() {
  console.log('Task 0: Running ESLint...');
  const eslint = new ESLint({
    cwd: __dirname,
  });
  const results = await eslint.lintFiles(['src/**/*.js']);
  const formatter = await eslint.loadFormatter('stylish');
  const resultText = formatter.format(results);
  if (resultText.trim().length > 0) {
    console.log(resultText);
  }

  const hasWarnings = results.some(result => result.warningCount > 0);
  const hasErrors = results.some(result => result.errorCount > 0);

  if (hasErrors || hasWarnings) {
    throw new Error('ESLint reported issues. Please fix the above warnings/errors.');
  }

  console.log('  - ✅ ESLint passed with no warnings.');
}

/**
 * 
 * Run the script using "node minify.js". Github Actions will always run this script, you can do it locally as well.
 * 
 * A comprehensive build script with detailed logging that:
 * 1. Minifies the source JavaScript.
 * 2. Builds a Tampermonkey script from a template.
 * 3. Builds a Chrome Extension content script.
 * 4. Updates the Chrome Extension manifest version.
 */
async function runBuild() {
  // --- Configuration: Define all file paths ---
  const paths = {
    source: path.join(__dirname, 'src', 'source.js'),
    minifiedSource: path.join(__dirname, 'builds', 'source.min.js'),
    tampermonkeyTemplate: path.join(__dirname, 'builds', 'tampermonkey_userscript', 'template.user.js'),
    tampermonkeyOutput: path.join(__dirname, 'builds', 'tampermonkey_userscript', 'bm-enhanced.min.js'),
    chromeExtensionOutput: path.join(__dirname, 'builds', 'chrome_extension', 'content.js'),
    manifest: path.join(__dirname, 'builds', 'chrome_extension', 'manifest.json'),
  };

  try {
  console.log('🚀 Starting build process...');
  console.log('--------------------------------------------------');

  await runLint();

    // --- 1. Read and minify the source code ---
    console.log('Task 1: Minifying source code...');
    console.log(`  - Reading source from: ${paths.source}`);
    const sourceCode = await fs.readFile(paths.source, 'utf8');
    const originalSize = Buffer.byteLength(sourceCode, 'utf8');
    console.log(`  - Original size: ${originalSize} bytes`);

    console.log('  - Running syntax check on source...');
    validateJavaScript(sourceCode, 'Source script', paths.source);

    const result = await terser.minify(sourceCode, {
      compress: true,
      mangle: { toplevel: true },
    });
    if (result.error) {
      throw new Error(`Terser minification failed: ${result.error.message || result.error}`);
    }
    const minifiedCode = result.code;
    const minifiedSize = Buffer.byteLength(minifiedCode, 'utf8');
    const reduction = (((originalSize - minifiedSize) / originalSize) * 100).toFixed(2);

    console.log('  - Running syntax check on minified output...');
    validateJavaScript(minifiedCode, 'Minified source');

    await fs.writeFile(paths.minifiedSource, minifiedCode);
    console.log(`  - Minified size: ${minifiedSize} bytes (Reduction: ${reduction}%)`);
    console.log(`  - Minified source written to: ${paths.minifiedSource}`);

    // --- 2. Extract version from source code ---
    console.log('\nTask 2: Extracting version number...');
    const versionRegex = /const EXTENSION_VERSION = "([^"]+)"/;
    const match = sourceCode.match(versionRegex);
    if (!match) {
      throw new Error(`Could not find version string matching '${versionRegex}' in ${paths.source}`);
    }
    const version = match[1];
    console.log(`  - Found version: "${version}"`);

    // --- 3. Build the Tampermonkey script ---
    console.log('\nTask 3: Building Tampermonkey script...');
    console.log(`  - Reading template from: ${paths.tampermonkeyTemplate}`);
    let templateContent = await fs.readFile(paths.tampermonkeyTemplate, 'utf8');

    console.log('  - Injecting minified code and updating version tag...');
    templateContent = templateContent
      .replace('//INJECT_MINIFIED_CODE_HERE', minifiedCode)
      .replace(/^\/\/ @version .*$/m, `// @version ${version}`);

  console.log('  - Running syntax check on Tampermonkey output...');
  validateJavaScript(templateContent, 'Tampermonkey script', paths.tampermonkeyOutput);

  await fs.writeFile(paths.tampermonkeyOutput, templateContent);
    console.log(`  - Tampermonkey script written to: ${paths.tampermonkeyOutput}`);

    // --- 4. Build the Chrome Extension script ---
    console.log('\nTask 4: Building Chrome Extension script...');
  console.log('  - Running syntax check on Chrome extension output...');
  validateJavaScript(minifiedCode, 'Chrome extension script', paths.chromeExtensionOutput);
    await fs.writeFile(paths.chromeExtensionOutput, minifiedCode);
    console.log(`  - Chrome Extension script written to: ${paths.chromeExtensionOutput}`);

    // --- 5. Update the Chrome Extension manifest version ---
    console.log('\nTask 5: Updating Chrome Extension manifest version...');
    console.log(`  - Reading manifest from: ${paths.manifest}`);
    const manifestRaw = await fs.readFile(paths.manifest, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const numericVersion = parseFloat(version);
    if (isNaN(numericVersion)) {
      throw new Error(`Cannot parse version "${version}" as a number for manifest.json`);
    }
    const manifestVersion = String(numericVersion);
    console.log(`  - Updating manifest version from "${manifest.version}" to "${manifestVersion}"`);
    manifest.version = manifestVersion;
    await fs.writeFile(paths.manifest, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`  - Chrome Extension manifest updated: ${paths.manifest}`);

    console.log('--------------------------------------------------');
    console.log('✨ Build finished successfully!');
    console.log('\nGenerated/Updated Files:');
    console.log(`  1. ${paths.minifiedSource}`);
    console.log(`  2. ${paths.tampermonkeyOutput}`);
    console.log(`  3. ${paths.chromeExtensionOutput}`);
    console.log(`  4. ${paths.manifest}`);

  } catch (err) {
    console.error('\n🚫🚫🚫 BUILD FAILED 🚫🚫🚫');
    console.error('--------------------------------------------------');
    console.error(err);
    console.error('--------------------------------------------------');
    process.exit(1); // Exit with an error code to fail the GitHub Action
  }
}

// --- Execution ---
runBuild();