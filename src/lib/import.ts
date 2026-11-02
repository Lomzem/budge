import { Effect } from 'effect';

import { decodeBankFile, type BankFile } from './domain/bankFiles';

const MAX_FILE_BYTES = 5_000_000;

export type ReadBankFile = { ok: true; file: BankFile } | { ok: false; message: string };

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
