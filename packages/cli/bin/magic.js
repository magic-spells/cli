#!/usr/bin/env node
// The `magic` binary. Plain JS so the Node version check runs before any modern syntax
// or dependency loads; everything else lives in the compiled shell (src/main.ts).

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
	process.stderr.write(`magic needs Node 24 or newer (this is Node ${process.versions.node}).\n`);
	process.exit(1);
}

const { run } = await import('../dist/main.js');
process.exitCode = await run(process.argv.slice(2));
