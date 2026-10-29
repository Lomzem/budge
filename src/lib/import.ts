// Reads a bank file in the browser with the shared decoders. The file never leaves the device;
// only its decoded Bank Rows go to Convex.
import { Effect } from 'effect';

import { decodeBankFile, type BankFile } from './domain/bankFiles';

// Years of statements fit in far less; anything bigger is not a bank export.
const MAX_FILE_BYTES = 5_000_000;

export type ReadBankFile = { ok: true; file: BankFile } | { ok: false; message: string };

/** The Bank Rows in `file` dated on or after the cutover date, or why it can't be read. */
export async function readBankFile(file: File, cutoverDate: string): Promise<ReadBankFile> {
	if (file.size > MAX_FILE_BYTES) {
		return { ok: false, message: 'This file is too large to be a bank export.' };
	}
	const text = await file.text();
	return await Effect.runPromise(
		decodeBankFile(text, cutoverDate).pipe(
			Effect.match({
				onSuccess: (decoded) => ({ ok: true as const, file: decoded }),
				onFailure: (error) => ({ ok: false as const, message: error.message })
			})
		)
	);
}
