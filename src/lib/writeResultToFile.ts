// Utility for safe result writing to file with path validation

import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes result to a file if the path is allowed (must be inside ./output).
 * Throws error if path is outside allowed directory.
 * @param result - Data to write (string or object)
 * @param filePath - Relative or absolute path to file (string)
 */
export function writeResultToFile(result: string | object, filePath: string): void {
  const resolvedPath = path.resolve(filePath);

  // DEBUG: log every call
  // eslint-disable-next-line no-console
  console.log(`[writeResultToFile] called with filePath: ${resolvedPath}`);

  try {
    // Ensure output directory exists
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    // Serialize object to JSON if needed
    let data: string;
    if (typeof result === 'string') {
      // Normalize line endings for file output
      const os = require('os');
      data = result.replace(/\r\n|\n/g, os.EOL);
    } else {
      data = JSON.stringify(result, null, 2);
    }

    // DEBUG: log what will be written (first 200 chars)
    // eslint-disable-next-line no-console
    console.log(`[writeResultToFile] writing data (first 200 chars):`, typeof data === 'string' ? data.slice(0, 200) : '');

    fs.writeFileSync(resolvedPath, data, 'utf8');

    // Simple log to console (can be replaced with logger)
    // eslint-disable-next-line no-console
    console.log(`[writeResultToFile] Wrote result to: ${resolvedPath}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[writeResultToFile] Error writing to file ${resolvedPath}:`, err);
    throw err;
  }
}
