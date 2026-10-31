// The doctor runner (COMPONENT-KIT "doctor"). Products contribute checks; the runner
// runs them in order, never throws, and reports one result per check.

import { toMagicError } from './errors.js';
import type { OpContext } from './operation.js';

export interface DoctorResult {
	name: string;
	ok: boolean;
	/** One human line. */
	detail: string;
	/** Scriptable payload for --json. */
	data?: unknown;
	/** The error code when the check failed on an error. */
	code?: string;
}

export interface DoctorCheck<C = unknown> {
	name: string;
	run(ctx: OpContext<C>): Promise<Omit<DoctorResult, 'name'>>;
}

export async function runDoctorChecks<C>(
	checks: DoctorCheck<C>[],
	ctx: OpContext<C>,
	product = 'magic'
): Promise<DoctorResult[]> {
	const results: DoctorResult[] = [];
	for (const check of checks) {
		try {
			results.push({ name: check.name, ...(await check.run(ctx)) });
		} catch (err) {
			const e = toMagicError(err, { product });
			results.push({
				name: check.name,
				ok: false,
				detail: e.hint ? `${e.message} — ${e.hint}` : e.message,
				code: e.code,
			});
		}
	}
	return results;
}
