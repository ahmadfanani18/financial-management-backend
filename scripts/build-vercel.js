import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

process.env.VERCEL = '1';

execSync('./node_modules/.bin/prisma generate', { stdio: 'inherit' });

await esbuild.build({
  entryPoints: ['src/vercel.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/handler.js',
  format: 'esm',
  external: ['@prisma/client', '.prisma/client', '@fastify/swagger', '@fastify/swagger-ui'],
  sourcemap: false,
  minify: false,
});

console.log('Build complete!');
