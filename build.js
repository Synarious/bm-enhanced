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

function validateCustomization(customization) {
  const required = {
    top: ['version', 'orgId', 'dataSources', 'tampermonkey', 'chromeExtension'],
    dataSources: ['adminList', 'customConfig'],
    tampermonkey: ['name', 'namespace', 'description', 'author', 'updateURL', 'downloadURL'],
    chromeExtension: ['name', 'description'],
  };

  const missing = [];

  for (const key of required.top) {
    if (customization[key] === undefined || customization[key] === null) {
      missing.push(`customization.${key}`);
    }
  }

  if (missing.length === 0) {
    for (const key of required.dataSources) {
      if (!customization.dataSources[key]) {
        missing.push(`customization.dataSources.${key}`);
      }
    }
    for (const key of required.tampermonkey) {
      if (!customization.tampermonkey[key]) {
        missing.push(`customization.tampermonkey.${key}`);
      }
    }
    for (const key of required.chromeExtension) {
      if (!customization.chromeExtension[key]) {
        missing.push(`customization.chromeExtension.${key}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `customization.json is missing required fields:\n  - ${missing.join('\n  - ')}`
    );
  }
}

async function runLint() {
  console.log('Task 0: Running ESLint...');
  const eslint = new ESLint({ cwd: __dirname });
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

async function validateJSONConfigs() {
  console.log('\nTask 0.5: Validating JSON config files...');
  const configFiles = [
    path.join(__dirname, 'src', 'config', 'termList.json'),
    path.join(__dirname, 'src', 'config', 'adminList.json'),
  ];
  let allValid = true;
  for (const filePath of configFiles) {
    try {
      const raw = await fs.readFile(filePath, 'utf8').catch(() => null);
      if (raw === null) {
        console.log(`  - ⚠️ ${path.basename(filePath)} not found, skipping.`);
        continue;
      }
      JSON.parse(raw);
      console.log(`  - ✅ ${path.basename(filePath)} is valid JSON.`);
    } catch (err) {
      console.error(`  - ❌ ${path.basename(filePath)} is invalid JSON: ${err.message}`);
      allValid = false;
    }
  }
  if (!allValid) {
    throw new Error('One or more JSON config files have syntax errors. Fix them before building.');
  }
}

/**
 * Build script that reads all user-customizable data from builds/customization.json,
 * replaces placeholders in source and build templates, then minifies.
 *
 * Run using "node build.js".
 */
async function runBuild() {
  const paths = {
    customization: path.join(__dirname, 'builds', 'customization.json'),
    source: path.join(__dirname, 'src', 'source.js'),
    resolvedSource: path.join(__dirname, 'builds', 'source-custom.js'),
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
    await validateJSONConfigs();

    // --- Read and validate customization ---
    console.log('Task 1: Reading customization.json...');
    console.log(`  - Configuration: ${paths.customization}`);
    const customizationRaw = await fs.readFile(paths.customization, 'utf8');
    let customization;
    try {
      customization = JSON.parse(customizationRaw);
    } catch (err) {
      throw new Error(`customization.json is not valid JSON: ${err.message}`);
    }

    validateCustomization(customization);
    console.log(`  - Version: ${customization.version}`);
    console.log(`  - Org ID: ${customization.orgId}`);

    const numericVersion = parseFloat(customization.version);
    if (isNaN(numericVersion)) {
      throw new Error(`Cannot parse version "${customization.version}" as a number for manifest.json`);
    }

    // --- Resolve source template placeholders ---
    console.log('\nTask 2: Resolving source template...');
    console.log(`  - Reading source template from: ${paths.source}`);
    let sourceCode = await fs.readFile(paths.source, 'utf8');

    sourceCode = sourceCode
      .replace('"__VERSION__"', `"${customization.version}"`)
      .replace('"__ORG_ID__"', customization.orgId)
      .replace('"__DATA_SOURCES__"', JSON.stringify(customization.dataSources));

    const originalSize = Buffer.byteLength(sourceCode, 'utf8');
    console.log(`  - Resolved source size: ${originalSize} bytes`);

    await fs.writeFile(paths.resolvedSource, sourceCode);
    console.log(`  - Resolved source written to: ${paths.resolvedSource}`);

    // --- Minify resolved source ---
    console.log('\nTask 3: Validating and minifying resolved source...');

    console.log('  - Running syntax check on resolved source...');
    validateJavaScript(sourceCode, 'Resolved source', paths.resolvedSource);

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

    // --- Build Tampermonkey script ---
    console.log('\nTask 4: Building Tampermonkey script...');
    console.log(`  - Reading template from: ${paths.tampermonkeyTemplate}`);
    let templateContent = await fs.readFile(paths.tampermonkeyTemplate, 'utf8');

    console.log('  - Injecting metadata and minified code...');
    const tm = customization.tampermonkey;
    templateContent = templateContent
      .replace(/^\/\/ @name .*$/m, `// @name ${tm.name}`)
      .replace(/^\/\/ @namespace .*$/m, `// @namespace ${tm.namespace}`)
      .replace(/^\/\/ @version .*$/m, `// @version ${customization.version}`)
      .replace(/^\/\/ @updateURL .*$/m, `// @updateURL ${tm.updateURL}`)
      .replace(/^\/\/ @downloadURL .*$/m, `// @downloadURL ${tm.downloadURL}`)
      .replace(/^\/\/ @description .*$/m, `// @description ${tm.description}`)
      .replace(/^\/\/ @author .*$/m, `// @author ${tm.author}`)
      .replace('//INJECT_MINIFIED_CODE_HERE', minifiedCode);

    console.log('  - Running syntax check on Tampermonkey output...');
    validateJavaScript(templateContent, 'Tampermonkey script', paths.tampermonkeyOutput);

    await fs.writeFile(paths.tampermonkeyOutput, templateContent);
    console.log(`  - Tampermonkey script written to: ${paths.tampermonkeyOutput}`);

    // --- Build Chrome Extension script ---
    console.log('\nTask 5: Building Chrome Extension script...');
    console.log('  - Running syntax check on Chrome extension output...');
    validateJavaScript(minifiedCode, 'Chrome extension script', paths.chromeExtensionOutput);
    await fs.writeFile(paths.chromeExtensionOutput, minifiedCode);
    console.log(`  - Chrome Extension script written to: ${paths.chromeExtensionOutput}`);

    // --- Update Chrome Extension manifest ---
    console.log('\nTask 6: Updating Chrome Extension manifest...');
    console.log(`  - Reading manifest from: ${paths.manifest}`);
    let manifestRaw = await fs.readFile(paths.manifest, 'utf8');

    const manifest = JSON.parse(manifestRaw);
    const ce = customization.chromeExtension;
    manifest.name = ce.name;
    manifest.description = ce.description;
    manifest.version = String(numericVersion);

    console.log(`  - Manifest version set to "${manifest.version}"`);
    console.log(`  - Manifest name: "${manifest.name}"`);

    await fs.writeFile(paths.manifest, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`  - Chrome Extension manifest updated: ${paths.manifest}`);

    console.log('--------------------------------------------------');
    console.log('✨ Build finished successfully!');
    console.log('\nGenerated/Updated Files:');
    console.log(`  1. ${paths.resolvedSource}`);
    console.log(`  2. ${paths.minifiedSource}`);
    console.log(`  3. ${paths.tampermonkeyOutput}`);
    console.log(`  4. ${paths.chromeExtensionOutput}`);
    console.log(`  5. ${paths.manifest}`);

  } catch (err) {
    console.error('\n🚫🚫🚫 BUILD FAILED 🚫🚫🚫');
    console.error('--------------------------------------------------');
    console.error(err.message || err);
    console.error('--------------------------------------------------');
    process.exit(1);
  }
}

runBuild();
