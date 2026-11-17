import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface AgentConfig {
	siteUrl: string;
	key: string;
	target: string[];
}

export function agentConfigPath() {
	const override = process.env.BUDGE_AGENT_CONFIG;
	if (override !== undefined && override !== '') return override;
	const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
	return join(configHome, 'budge', 'agent.json');
}

function isAgentConfig(value: unknown): value is AgentConfig {
	if (typeof value !== 'object' || value === null) return false;
	const { siteUrl, key, target } = value as Record<string, unknown>;
	return (
		typeof siteUrl === 'string' &&
		typeof key === 'string' &&
		Array.isArray(target) &&
		target.every((part) => typeof part === 'string')
	);
}

export function readAgentConfig(): AgentConfig | undefined {
	const path = agentConfigPath();
	if (!existsSync(path)) return undefined;
	const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
	return isAgentConfig(parsed) ? parsed : undefined;
}

export function writeAgentConfig(config: AgentConfig) {
	const path = agentConfigPath();
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	const staged = `${path}.${String(process.pid)}.tmp`;
	writeFileSync(staged, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
	renameSync(staged, path);
}

export function removeAgentConfig() {
	rmSync(agentConfigPath(), { force: true });
}
