import { expect, type Download, type Locator, type Page } from '@playwright/test';

import type { FixtureName } from '../../scripts/app/fixtures';
import { formatCents, parseCents } from '../../src/lib/domain/money';

export async function choose(field: Locator, option: string | RegExp) {
	await field.click();
	const listbox = field.page().getByRole('listbox');
	await listbox.getByRole('option', { name: option, exact: true }).click();
	await expect(listbox).toBeHidden();
}

export async function choicesOf(field: Locator) {
	await field.click();
	const listbox = field.page().getByRole('listbox');
	await expect(listbox).toBeVisible();
	const names = await listbox.getByRole('option').allInnerTexts();
	await field.press('Escape');
	await expect(listbox).toBeHidden();
	return names.map((name) => name.trim());
}

export interface JourneyContext {
	step: <T>(name: string, body: () => Promise<T>) => Promise<T>;
	keepAsEvidence: (download: Download) => Promise<string>;
}

export interface Journey {
	title: string;
	fixture: FixtureName;
	run: (page: Page, context: JourneyContext) => Promise<void>;
}

export function cents(text: string | null) {
	const amount = parseCents((text ?? '').trim());
	if (amount === undefined) throw new Error(`${String(text)} is not an amount.`);
	return amount;
}

export async function centsIn(locator: Locator) {
	return cents(await locator.textContent());
}

export function typed(amountInCents: number) {
	return formatCents(amountInCents).replace('$', '');
}

export async function openAccount(page: Page, name: string) {
	await page
		.getByRole('navigation', { name: 'Sections and Accounts' })
		.getByRole('link', { name: new RegExp(`^${name}`) })
		.click();
	await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

export async function chooseBankFile(page: Page, name: string, csv: string) {
	const field = page.getByRole('dialog', { name: 'Import a bank file' }).getByLabel('File');
	await expect(field).toBeEnabled();
	await field.setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(csv) });
}

export async function openBudget(page: Page) {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Budget', exact: true })).toBeVisible();
}

export async function expectClearOf(subject: Locator, ...others: Locator[]) {
	await expect(subject).toBeInViewport({ ratio: 1 });
	const box = await subject.boundingBox();
	if (box === null) throw new Error('It has no box on screen.');
	for (const other of others) {
		const covering = await other.boundingBox();
		if (covering === null) continue;
		const overlapsAcross = box.x < covering.x + covering.width && covering.x < box.x + box.width;
		const overlapsDown = box.y < covering.y + covering.height && covering.y < box.y + box.height;
		expect(overlapsAcross && overlapsDown, `${String(other)} overlaps ${String(subject)}`).toBe(
			false
		);
	}
}

export async function expectNothingPastTheRightEdge(page: Page) {
	const past = await page.locator('body').evaluate((body) => {
		const screenRight = document.documentElement.clientWidth;
		const clipsOnPurpose = (element: Element) => {
			const style = getComputedStyle(element);
			const scrollsOnlySideways =
				['auto', 'scroll'].includes(style.overflowX) &&
				['hidden', 'clip'].includes(style.overflowY);
			const visuallyHidden = style.clipPath === 'inset(50%)';
			return scrollsOnlySideways || visuallyHidden || style.textOverflow === 'ellipsis';
		};
		const insideAClipOnPurpose = (element: Element) => {
			for (let box = element.parentElement; box !== null; box = box.parentElement) {
				if (clipsOnPurpose(box)) return true;
			}
			return false;
		};
		const named = (element: Element) => {
			const slot = element.getAttribute('data-slot');
			const text = element.textContent.trim().slice(0, 40);
			return `<${element.localName}${slot === null ? '' : ` data-slot="${slot}"`}> "${text}"`;
		};
		return [...body.querySelectorAll('*')]
			.filter((element) => element.checkVisibility({ visibilityProperty: true }))
			.filter((element) => !insideAClipOnPurpose(element))
			.flatMap((element) => {
				const box = element.getBoundingClientRect();
				if (box.width === 0 || box.height === 0) return [];
				if (box.right > screenRight + 0.5)
					return [`${named(element)} ends at ${String(box.right)}, past the screen`];
				const hidesContentAcross =
					getComputedStyle(element).overflowX !== 'visible' &&
					!clipsOnPurpose(element) &&
					element.scrollWidth > element.clientWidth + 1;
				return hidesContentAcross
					? [
							`${named(element)} hides ${String(element.scrollWidth - element.clientWidth)} px of its content to the right`
						]
					: [];
			})
			.slice(0, 5);
	});
	expect(
		past,
		`content past the right edge of a ${String(page.viewportSize()?.width)} px viewport`
	).toEqual([]);
}

export async function expectEveryAmountShownInFull(table: Locator) {
	const cut = await table.evaluate((root) =>
		[...root.querySelectorAll('td, th, input')]
			.filter((element) => element.checkVisibility({ visibilityProperty: true }))
			.filter((element) => element.scrollWidth > element.clientWidth + 1)
			.map((element) => {
				const text = element instanceof HTMLInputElement ? element.value : element.textContent;
				return `<${element.localName}> "${text.trim().slice(0, 40)}" needs ${String(element.scrollWidth)} px in ${String(element.clientWidth)} px`;
			})
	);
	expect(cut, `cut-off amounts at ${String(table.page().viewportSize()?.width)} px`).toEqual([]);
}

export async function useATouchScreen(page: Page) {
	const emulation = await page.context().newCDPSession(page);
	await emulation.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
	await expect.poll(() => page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
	return async () => {
		await emulation.send('Emulation.setTouchEmulationEnabled', { enabled: false });
		await emulation.detach();
	};
}

export interface Finger {
	id: number;
	x: number;
	y: number;
}

export async function touchscreen(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	return {
		async touch(type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', fingers: Finger[]) {
			await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: fingers });
		},
		async detach() {
			await cdp.detach();
		}
	};
}

export async function centerOf(locator: Locator) {
	const box = await locator.boundingBox();
	if (box === null) throw new Error('The element is not on screen.');
	return { x: box.x + box.width / 2, y: box.y + box.height / 2, top: box.y };
}

export async function tap(page: Page, locator: Locator) {
	await locator.scrollIntoViewIfNeeded();
	const { x, y } = await centerOf(locator);
	const screen = await touchscreen(page);
	await screen.touch('touchStart', [{ id: 1, x, y }]);
	await screen.touch('touchEnd', []);
	await screen.detach();
}

export async function expectTapTargetHeight(target: Locator, height: number) {
	await target.scrollIntoViewIfNeeded();
	const missedAt = await target.evaluate(
		(element, reach) => {
			const box = element.getBoundingClientRect();
			const x = box.left + box.width / 2;
			const middle = box.top + box.height / 2;
			return [middle - reach, middle + reach].filter(
				(y) => document.elementFromPoint(x, y)?.closest('button') !== element
			);
		},
		height / 2 - 1
	);
	expect(missedAt, `${String(target)} misses taps within ${String(height)} px`).toEqual([]);
}
