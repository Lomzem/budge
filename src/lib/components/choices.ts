export interface Choice {
	value: string;
	label: string;
	disabled?: boolean;
}
export interface ChoiceGroup {
	group: string;
	choices: readonly Choice[];
}
export type Choices = readonly (Choice | ChoiceGroup)[];

export function matchingChoices(choices: Choices, search: string): Choices {
	const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return choices;
	const matches = (choice: Choice) =>
		!choice.disabled && terms.every((term) => choice.label.toLowerCase().includes(term));
	return choices.flatMap((entry): (Choice | ChoiceGroup)[] => {
		if (!('group' in entry)) return matches(entry) ? [entry] : [];
		const kept = entry.choices.filter(matches);
		return kept.length === 0 ? [] : [{ group: entry.group, choices: kept }];
	});
}
