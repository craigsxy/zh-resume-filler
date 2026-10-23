import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const base = {
  bundle: true,
  format: 'iife',
  target: ['chrome100'],
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
  minify: false,
  sourcemap: false,
};

const targets = [
  { in: 'src/content-entry.js', out: 'content.bundle.js' },
  { in: 'src/panel/index.js', out: 'panel.bundle.js' },
];

for (const t of targets) {
  const opts = { ...base, entryPoints: [t.in], outfile: t.out };
  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
  } else {
    await esbuild.build(opts);
  }
}

console.log(watch ? '[build] watching src/ ...' : '[build] done');
