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
