export function moveInList<T>(items: readonly T[], from: number, to: number): T[] {
	const moved = [...items];
	const [item] = moved.splice(from, 1);
	if (item !== undefined) moved.splice(to, 0, item);
	return moved;
}
