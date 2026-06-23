import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

execSync('./node_modules/.bin/prisma generate', { stdio: 'inherit' });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  format: 'esm',
  external: ['@prisma/client', '.prisma/client'],
  sourcemap: false,
  minify: false,
});

await esbuild.build({
  entryPoints: ['src/vercel.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/vercel.js',
  format: 'esm',
  external: ['@prisma/client', '.prisma/client'],
  sourcemap: false,
  minify: false,
});

console.log('Build complete!');