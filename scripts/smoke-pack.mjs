// Packs magic-spells (prepack bundles it), installs the tarball into an empty
// directory with only its declared dependencies, and runs the installed `magic`.
// Proves the tarball is self-contained. Never publishes.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sh = { shell: process.platform === 'win32' };
const root = fileURLToPath(new URL('..', import.meta.url));
const version = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8')).version;

const work = mkdtempSync(join(tmpdir(), 'magic-smoke-'));
const out = execFileSync(
	npm,
	['pack', '-w', 'packages/cli', '--pack-destination', work, '--json'],
	{
		cwd: root,
		encoding: 'utf8',
		...sh,
	}
);
const filename = JSON.parse(out)[0].filename;
if (filename !== `magic-spells-${version}.tgz`)
	throw new Error(`packed ${filename}, want magic-spells-${version}.tgz`);
const tarball = join(work, filename);

const app = join(work, 'app');
mkdirSync(app);
execFileSync(npm, ['init', '-y'], { cwd: app, stdio: 'ignore', ...sh });
execFileSync(npm, ['install', '--no-audit', '--no-fund', tarball], {
	cwd: app,
	stdio: 'inherit',
	...sh,
});

const bin = join(app, 'node_modules/magic-spells/bin/magic.js');
const magic = (...args) =>
	execFileSync(process.execPath, [bin, ...args], {
		cwd: app,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	});

const got = magic('--version').trim();
if (got !== `magic ${version}`)
	throw new Error(`--version printed "${got}", want "magic ${version}"`);
magic('--help');
magic('pyramid', '--help');
console.log(`smoke ok: ${tarball} installs and runs (${got})`);
