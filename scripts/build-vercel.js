import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

execSync('./node_modules/.bin/prisma generate', { stdio: 'inherit' });

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  format: 'cjs',
  external: ['@prisma/client', '.prisma/client', 'node:*'],
  sourcemap: false,
  minify: false,
});

console.log('Build complete!');
