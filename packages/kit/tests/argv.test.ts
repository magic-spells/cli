// Flag and positional derivation from zod (FEATURE-KIT-EXTRACTION acceptance).

import { describe, expect, it } from 'vitest';

import {
	buildCommands,
	describeFields,
	flagToKey,
	matchCommand,
	parseCommandArgs,
	parseGlobals,
} from '../src/argv.js';
import { demoOps } from './helpers.js';

const cmds = buildCommands(demoOps);
const cmd = (name: string) => cmds.find((c) => c.op.name === name)!;

describe('parseGlobals', () => {
	it('pulls global flags from anywhere in argv', () => {
		const g = parseGlobals(
			['widget', '--json', 'list', '-y', '-q', '--no-cache', '--no-color'],
			[],
			{}
		);
		expect(g.rest).toEqual(['widget', 'list']);
		expect(g.opts).toMatchObject({
			json: true,
			yes: true,
			quiet: true,
			noCache: true,
			color: false,
		});
	});

	it('reads --workspace and product value flags in both spellings', () => {
		const g = parseGlobals(['--workspace', 'acme', 'x', '--project=web'], ['project'], {});
		expect(g.opts.workspace).toBe('acme');
		expect(g.productFlags).toEqual({ project: 'web' });
		expect(g.rest).toEqual(['x']);
	});

	it('honours NO_COLOR', () => {
		expect(parseGlobals([], [], { NO_COLOR: '1' }).opts.color).toBe(false);
	});

	it('a value flag with no value is a usage error', () => {
		expect(() => parseGlobals(['--workspace'], [], {})).toThrow(/expects a value/);
	});
});

describe('command matching', () => {
	it('matches noun + verb, verb aliases, and product-level verbs', () => {
		expect(matchCommand(cmds, ['widget', 'list'])?.cmd.op.name).toBe('demo.widget.list');
		expect(matchCommand(cmds, ['widget', 'ls'])?.cmd.op.name).toBe('demo.widget.list');
		expect(matchCommand(cmds, ['widget', 'next'])?.cmd.op.name).toBe('demo.widget.list-mine');
		expect(matchCommand(cmds, ['whoami'])?.cmd.op.name).toBe('demo.whoami');
		expect(matchCommand(cmds, ['widget', 'bogus'])).toBeUndefined();
	});

	it('returns the remaining args', () => {
		expect(matchCommand(cmds, ['widget', 'move', 'W-1', '--urgent'])?.args).toEqual([
			'W-1',
			'--urgent',
		]);
	});
});

describe('field derivation', () => {
	it('classifies strings, numbers, booleans, arrays, enums and object arrays', () => {
		const kinds = Object.fromEntries(
			describeFields(cmd('demo.widget.move').op.input).map((f) => [f.key, f.kind])
		);
		expect(kinds).toMatchObject({
			widget: 'string',
			labels: 'string[]',
			urgent: 'boolean',
			color: 'enum',
		});
		expect(describeFields(cmd('demo.widget.bulk').op.input)[0]?.kind).toBe('json');
		expect(
			describeFields(cmd('demo.widget.list').op.input).find((f) => f.key === 'limit')?.kind
		).toBe('number');
	});

	it('maps kebab, singular-plural and first-segment flags to keys', () => {
		const fields = describeFields(cmd('demo.widget.move').op.input);
		expect(flagToKey('after-widget', fields)).toBe('after_widget');
		expect(flagToKey('label', fields)).toBe('labels');
		expect(flagToKey('after', fields)).toBe('after_widget');
		expect(flagToKey('s', fields, { s: 'status' })).toBe('status');
		expect(flagToKey('nope', fields)).toBeUndefined();
	});
});

describe('parseCommandArgs', () => {
	it('fills positionals, flags, booleans and repeated/comma arrays', () => {
		const p = parseCommandArgs(cmd('demo.widget.move'), [
			'W-1',
			'--status',
			'In Review',
			'--after',
			'W-0',
			'--label',
			'a,b',
			'--label=c',
			'--urgent',
			'--color',
			'red',
		]);
		expect(p.raw).toEqual({
			widget: 'W-1',
			status: 'In Review',
			after_widget: 'W-0',
			labels: ['a', 'b', 'c'],
			urgent: true,
			color: 'red',
		});
	});

	it('unknown flags and extra positionals are usage errors', () => {
		expect(() => parseCommandArgs(cmd('demo.widget.move'), ['W-1', '--bogus'])).toThrow(
			/unknown flag --bogus/
		);
		expect(() => parseCommandArgs(cmd('demo.widget.move'), ['W-1', 'W-2'])).toThrow(
			/unexpected argument/
		);
	});

	it('collects declared switches and --file', () => {
		expect(parseCommandArgs(cmd('demo.widget.archive'), ['W-1', '--unarchive']).switches).toEqual([
			'unarchive',
		]);
		expect(parseCommandArgs(cmd('demo.widget.bulk'), ['--file', 'x.json']).file).toBe('x.json');
	});
});
