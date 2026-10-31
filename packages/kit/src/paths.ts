// Where the CLI keeps its files: ~/.config/magic (XDG_CONFIG_HOME honoured) or
// %APPDATA%\magic on Windows.

import { homedir } from 'node:os';
import { join } from 'node:path';

export interface PathEnv {
	platform?: NodeJS.Platform;
	env?: NodeJS.ProcessEnv;
	home?: string;
}

export function configDir(opts: PathEnv = {}): string {
	const platform = opts.platform ?? process.platform;
	const env = opts.env ?? process.env;
	const home = opts.home ?? homedir();
	if (platform === 'win32') return join(env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'magic');
	return join(env.XDG_CONFIG_HOME || join(home, '.config'), 'magic');
}
