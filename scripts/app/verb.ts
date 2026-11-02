export interface Verb {
	usage: string;
	summary: string;
	details: string;
	run: (args: string[]) => Promise<void>;
}
