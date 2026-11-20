#!/bin/sh
if [ -z "${CODEX_THREAD_ID+x}${CODEX_TOOL_CALL_ID+x}" ]; then
	exit 0
fi
staged=$(git diff --cached --name-only --no-renames -- \
	':(top,glob)src/**/*.svelte' \
	':(top,literal)src/app.css' \
	':(top,literal)src/app.html' \
	':(top,glob)src/lib/components/**/*.ts') || {
	echo 'UI ownership: could not read the staged paths.' >&2
	exit 1
}
[ -z "$staged" ] && exit 0
{
	echo 'UI ownership: only Opus edits UI (AGENTS.md, "Model ownership"). This commit stages:'
	printf '%s\n' "$staged" | sed 's/^/  /'
	echo 'Unstage them and hand the change to Opus with delegate_task.'
} >&2
exit 1
