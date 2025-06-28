const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');

const inputPath = path.join(__dirname, 'code', 'source.js');
const outputPath = path.join(__dirname, 'code', 'source.min.js');

// Read the source file
fs.readFile(inputPath, 'utf8', (err, code) => {
  if (err) {
    console.error('Failed to read source.js:', err);
    return;
  }

  try {
    // Minify the code using UglifyJS
    const result = UglifyJS.minify(code);

    if (result.error) {
      console.error('UglifyJS error:', result.error);
      return;
    }

    // Write minified output
    fs.writeFile(outputPath, result.code, (err) => {
      if (err) {
        console.error('Failed to write source.min.js:', err);
      } else {
        console.log('Minification successful: code/source.min.js');
      }
    });
  } catch (e) {
    console.error('Unexpected error during minification:', e);
  }
});