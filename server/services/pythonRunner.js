import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Correct absolute path to main.py
const scriptPath = path.resolve(__dirname, '../python/ocr_service/main.py');

export const runPythonOCR = (pdfPath) => {
  return new Promise((resolve, reject) => {
    execFile('python', [scriptPath, pdfPath], (error, stdout, stderr) => {
      if (error) return reject(stderr || error.message);
      resolve(stdout);
    });
  });
};
