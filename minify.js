const fs = require('fs');
const path = require('path');
const UglifyJS = require('uglify-js');

// Set the input and output file paths
const inputPath = path.join(__dirname, 'code', 'source.js');  // Path to the original source.js
const outputPath = path.join(__dirname, 'code', 'source.min.js');  // Path to save the minified source.min.js

// Read the source file
fs.readFile(inputPath, 'utf8', (err, code) => {
  if (err) {
    console.error('Failed to read source.js:', err);
    return;
  }

  try {
    // Minify the code using UglifyJS with the desired options
    const result = UglifyJS.minify(code, {
      compress: true,  // Enable compression (removes unnecessary whitespace, optimizes code)
      mangle: true,    // Mangle variable and function names to reduce size
      output: {
        // Force output to be a single line by setting `preamble` to `false`
        beautify: false,  // Disable beautifying (prettifying the code)
        comments: false,  // Remove all comments
        // Force single-line output with minimal space
        max_line_len: 0
      }
    });

    // Check for any errors during minification
    if (result.error) {
      console.error('UglifyJS error:', result.error);
      return;
    }

    // Write the minified output to the output file
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
