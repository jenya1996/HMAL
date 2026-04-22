import fs from 'fs';
import path from 'path';

const IS_PROD = process.env.NODE_ENV === 'production';
const LOG_FILE = path.join(process.cwd(), 'logs.txt');

if (!IS_PROD) {
  fs.appendFileSync(LOG_FILE, `\n${'='.repeat(60)}\nServer started: ${new Date().toISOString()}\n${'='.repeat(60)}\n`);
}

function format(level: string, ...args: unknown[]): string {
  const ts = new Date().toISOString();
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
  return `[${ts}] [${level}] ${msg}\n`;
}

function write(line: string) {
  if (!IS_PROD) fs.appendFileSync(LOG_FILE, line);
}

export const logger = {
  log(...args: unknown[]) {
    const line = format('INFO ', ...args);
    process.stdout.write(line);
    write(line);
  },
  warn(...args: unknown[]) {
    const line = format('WARN ', ...args);
    process.stdout.write(line);
    write(line);
  },
  error(...args: unknown[]) {
    const line = format('ERROR', ...args);
    process.stderr.write(line);
    write(line);
  },
};
