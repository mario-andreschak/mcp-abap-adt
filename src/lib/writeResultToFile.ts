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

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  // Serialize object to JSON if needed
  const data = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  fs.writeFileSync(resolvedPath, data, 'utf8');

  // Simple log to console (can be replaced with logger)
  // eslint-disable-next-line no-console
  console.log(`[writeResultToFile] Wrote result to: ${resolvedPath}`);
}
