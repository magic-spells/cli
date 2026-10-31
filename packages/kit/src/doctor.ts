// The doctor runner (COMPONENT-KIT "doctor"). Products contribute checks; the runner
// runs them in order, never throws, and reports one result per check.

import { toMagicError } from './errors.js';
import type { OpContext } from './operation.js';

export interface DoctorResult {
	name: string;
	/** The product the check belongs to; `magic` for the shell's own checks. */
	product: string;
	ok: boolean;
	/** Passed, but with something worth knowing (e.g. the file credential store). */
	warn?: boolean;
	/** One human line. */
	detail: string;
	/** Scriptable payload for --json. */
	data?: unknown;
	/** The error code when the check failed on an error. */
	code?: string;
}

export interface DoctorCheck<C = unknown> {
	name: string;
	run(ctx: OpContext<C>): Promise<Omit<DoctorResult, 'name' | 'product'>>;
}

export async function runDoctorChecks<C>(
	checks: DoctorCheck<C>[],
	ctx: OpContext<C>,
	product = 'magic'
): Promise<DoctorResult[]> {
	const results: DoctorResult[] = [];
	for (const check of checks) {
		try {
			results.push({ name: check.name, product, ...(await check.run(ctx)) });
		} catch (err) {
			const e = toMagicError(err, { product });
			results.push({
				name: check.name,
				product,
				ok: false,
				detail: e.hint ? `${e.message} — ${e.hint}` : e.message,
				code: e.code,
			});
		}
	}
	return results;
}
