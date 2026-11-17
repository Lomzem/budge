export default [
	{
		file: 'src/lib/components/accounts/reconcile-dialog.svelte',
		text: 'If the bank shows the cleared balance, confirm it in one tap. Otherwise enter what the bank shows; Budge adds an adjustment for the difference. Either way, the Cleared Transactions lock as Reconciled.'
	},
	{
		file: 'src/lib/components/accounts/reconcile-dialog.svelte',
		text: 'It differs by {formatCents(difference)}. Budge adds one Reconciliation Adjustment for it, in Ready to Assign, which you can change later.'
	},
	{
		file: 'src/lib/components/accounts/starting-balance-step.svelte',
		text: "Budge's estimate is the bank's balance less the imported Transactions, so a missing Transaction or an out-of-date balance makes it wrong. A working connection doesn't prove it either. Compare it with your bank statement balance for the start of {since ?? 'the cutover date'}."
	},
	{
		file: 'src/lib/components/bank/connection-card.svelte',
		text: 'Its earlier Transactions are still in {feed.historyIn.name}. Only new ones come to {feed.name}.'
	},
	{
		file: 'src/lib/components/bank/connection-card.svelte',
		text: 'Budge skips their transactions. Bring one back and set it up to choose where its new transactions go, from the next sync. The ones it already brought in stay where they are.'
	},
	{
		file: 'src/lib/components/bank/connection-card.svelte',
		text: 'Budge stops syncing it and forgets its bank Accounts and any transactions waiting for setup. Transactions it already brought in stay in your Accounts. To sync this bank again, connect it again.'
	},
	{
		file: 'src/lib/components/bank/held-account-dialog.svelte',
		text: 'The bank says this is {kindName(session.bankAccount.kind)}, but {target.name} is {kindName( target.kind )}, so its balance would count the wrong way. Choose a matching Account or a new one.'
	},
	{
		file: 'src/lib/components/bank/held-account-dialog.svelte',
		text: "The bank didn't say what kind of account this is, so make sure it is {kindName( target.kind )} like {target.name}."
	},
	{
		file: 'src/lib/components/bank/held-account-dialog.svelte',
		text: 'Its transactions are dropped, and Budge stops asking. Bring it back from its Bank card any time.'
	},
	{
		file: 'src/lib/components/categories/delete-category-dialog.svelte',
		text: "Its Transactions and Assigned amounts move to the Category you pick, in every month, so every Available stays exact. This can't be undone."
	},
	{
		file: 'src/lib/components/settings/cutover-date.svelte',
		text: 'Puts the start date back on {formatDate(move.from)}, with the Transactions before {formatDate( move.to )} back in their Accounts.'
	},
	{
		file: 'src/lib/components/settings/later-cutover-preview.svelte',
		text: 'A preview of moving the cutover date from {formatDate(from)}. Nothing changes until you move it.'
	},
	{
		file: 'src/lib/components/settings/later-cutover-preview.svelte',
		text: 'Nothing is dated before {newDate}, so moving the date changes no balance and no Transaction.'
	},
	{
		file: 'src/lib/components/settings/later-cutover-preview.svelte',
		text: "{newDate} is after today. Bank transactions dated before it, including the coming days, won't be brought in."
	},
	{
		file: 'src/lib/components/settings/later-cutover-preview.svelte',
		text: 'The {formatCents(budget.removedAssignments.total)} assigned in {monthsText( budget.removedAssignments.months )} goes, and {formatMonth(budget.month)} starts with nothing carried over.'
	},
	{
		file: 'src/lib/components/settings/later-cutover-preview.svelte',
		text: 'Reconciled Transactions and Starting Balances above fold into new Starting Balances, which are cleared but not reconciled.'
	},
	{
		file: 'src/lib/components/shell/export-dialog.svelte',
		text: 'Download everything in Budge as a backup. Bank Connection tokens are left out.'
	},
	{
		file: 'src/lib/components/shell/export-dialog.svelte',
		text: 'JSON is one file. CSV is one file per table, so your browser may ask to allow several downloads.'
	},
	{
		file: 'src/lib/components/transactions/import-dialog.svelte',
		text: 'A Capital One CSV or QFX file, or a Discover CSV file. Budge reads it on this device and saves only its rows.'
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: 'Line amounts follow the Direction; a minus sign turns a line the other way.'
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: "Reconciled: its Account, date, and amount are locked, and it can't be deleted."
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: 'A starting balance stays in its Account, with no Payee and one Category.'
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: 'The other side is kept in step: editing or deleting one side changes both.'
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: 'More Bank Rows back this Transaction than are shown here. Flagged ones come first, and search still finds every Bank Text.'
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: "The bank removed it. Both sides are deleted, here and in {transaction.transfer .accountName}. This can't be undone."
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: "The bank removed it. Its amount comes out of the Account balance. This can't be undone."
	},
	{
		file: 'src/lib/components/transactions/transaction-dialog.svelte',
		text: 'It stops being Reconciled right away, so its Account, date and amount can change and it can be deleted. Reconcile the Account again to lock it.'
	},
	{
		file: 'src/lib/components/transactions/transaction-table.svelte',
		text: "The bank removed {confirmRemoval.payee}. Both sides are deleted, here and in {confirmRemoval .row.transfer.accountName}. This can't be undone."
	},
	{
		file: 'src/lib/components/transactions/transaction-table.svelte',
		text: "The bank removed {confirmRemoval?.payee}. Its amount comes out of the Account balance. This can't be undone."
	},
	{
		file: 'src/routes/(app)/+page.svelte',
		text: 'Add an Account with its current balance, or connect a bank from the Bank page.'
	},
	{
		file: 'src/routes/(app)/+page.svelte',
		text: 'No Categories yet. Add a Category Group, then Categories to assign money to.'
	},
	{
		file: 'src/routes/(app)/accounts/+page.svelte',
		text: 'Add an Account with its current balance, or connect a bank from the Bank page.'
	},
	{
		file: 'src/routes/(app)/bank/+page.svelte',
		text: 'New transactions arrive Unapproved as they post, ready to review on each Account. They count in your budget right away, and Budge checks each bank daily.'
	},
	{
		file: 'src/routes/(app)/bank/+page.svelte',
		text: "Bank sync isn't set up on this server: it needs Plaid credentials. You can still import a bank file from an Account's page."
	},
	{
		file: 'src/routes/(app)/bank/+page.svelte',
		text: 'Set the cutover date below before connecting a bank, so Budge knows which transactions to bring in.'
	},
	{
		file: 'src/routes/(app)/bank/+page.svelte',
		text: "This server uses Plaid's sandbox, so no real bank is involved. In Plaid Link, pick any bank and sign in as user_good with password pass_good."
	},
	{
		file: 'src/routes/(app)/bank/+page.svelte',
		text: "Connect a bank to bring in its transactions automatically. Without one, import a bank file from an Account's page."
	},
	{
		file: 'src/routes/(app)/categories/+page.svelte',
		text: 'Press the arrow keys, Home or End to move it, or drag it.'
	},
	{
		file: 'src/routes/(app)/categories/+page.svelte',
		text: 'No Categories yet. Add a Category Group, then Categories to assign money to.'
	}
];
