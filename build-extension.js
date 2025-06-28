const fs = require("fs");
const path = require("path");
const CRX = require("crx");
const fse = require("fs-extra");

// Configurable absolute or relative paths for all files/folders
// You can modify these independently however you want
const paths = {
  extensionDir: path.resolve(__dirname, "./code/chrome_extension"), // anywhere
  sourceFile: path.resolve(__dirname, "./code/source.min.js"),         // anywhere
  tempDir: path.resolve(__dirname, "./temp_build"),                           // anywhere
  outputDir: path.resolve(__dirname, "./code/remoteUpdate_crx"),           // anywhere
  outputFileName: "extension.crx",                                           // just filename
  privateKeyFile: path.resolve(__dirname, "./code/private.pem"),              // anywhere
};

// Compose full output file path (outputDir + outputFileName)
const outputFile = path.join(paths.outputDir, paths.outputFileName);

async function buildCrx() {
  try {
    if (!fs.existsSync(paths.privateKeyFile)) {
      console.error("Missing private.pem file at:", paths.privateKeyFile);
      process.exit(1);
    }

    // Cleanup previous temp folder
    if (await fse.pathExists(paths.tempDir)) {
      await fse.remove(paths.tempDir);
    }

    // Copy chrome_extension folder to tempDir
    await fse.copy(paths.extensionDir, paths.tempDir);

    // Copy source.min.js into tempDir (at root of extension)
    await fse.copy(paths.sourceFile, path.join(paths.tempDir, path.basename(paths.sourceFile)));

    // Ensure output directory exists and clean old CRX if present
    if (!(await fse.pathExists(paths.outputDir))) {
      await fse.mkdir(paths.outputDir, { recursive: true });
    }
    if (await fse.pathExists(outputFile)) {
      await fse.unlink(outputFile);
    }

    // Create CRX
    const crx = new CRX({
      privateKey: await fse.readFile(paths.privateKeyFile),
    });

    await crx.load(paths.tempDir);
    const crxBuffer = await crx.pack();

    await fse.writeFile(outputFile, crxBuffer);

    // Cleanup temp folder
    await fse.remove(paths.tempDir);

    console.log("✅ CRX built at:", outputFile);
  } catch (err) {
    console.error("❌ Failed to build CRX:", err);
  }
}

buildCrx();
