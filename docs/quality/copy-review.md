# Copy review

`local/banned-copy`, `local/no-heading-lede` and `local/concise-copy` catch the phrasings and shapes a parser can see. This review covers the judgment calls they miss. Run it on every change that adds or rewrites UI text, before `code-review`.

## Who runs it

A Sol reviewer in a fresh context reports findings. Opus decides each one and edits the copy. The reviewer never edits UI files.

## What to review

List every string the diff adds or changes that a person can see or hear: text in `.svelte` files, `aria-label`, `aria-description`, `title`, `placeholder`, `alt`, and strings built in `.ts` files that reach the page (statuses, notes, announcements, errors). For each one, open the running screen or the markup around it and answer the questions below.

## What the owner rejects

Each line is copy the owner removed, with the reason. Flag anything that does the same job, even in different words.

| Rejected copy                                                                   | Why it went                                                                      |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `New transactions arrive Unapproved on each Account. Budge checks banks daily.` | Explains how Budge works under a page heading. Nobody acts on it.                |
| `Reconnect if the bank asks you to sign in again.`                              | Advice about when to press a button that is already on screen.                   |
| `Budge tracks money and imports bank transactions from this date.`              | Restates what the setting's label already says.                                  |
| `Starts on 1 Nov, moved from 1 Oct.` and its `Undo move`                        | History the person did not ask for, beside the current value.                    |
| `Your data` / `Download CSV or JSON.`                                           | A heading plus a line that repeats the buttons below it.                         |
| Export dialog description and status chatter                                    | A dialog that only explains two buttons. The buttons now sit on Settings.        |
| `Nothing needs you right now.`                                                  | An empty state that announces emptiness. Show nothing instead.                   |
| `Set aside $59.98 each month, due on the 1st`                                   | A sentence where a terse fact (`$59.98 monthly, due 1st`) does the job.          |
| `Add to home screen` on a laptop                                                | An offer that cannot apply to the device showing it.                             |
| `Select a Category.` in an empty panel                                          | A placeholder panel that tells the person to do what the screen already invites. |
| `Funded` in a row and `No` in the column beside it                              | Two words for one fact that disagree. One status, said once.                     |

## Questions for each string

1. **Does anyone act on it?** If the person does nothing differently after reading it, cut it.
2. **Does the screen already say it?** A heading, label, button, or value beside it that carries the same fact makes this string redundant.
3. **Is it describing Budge instead of the person's money?** Sync schedules, import rules, and storage details belong in docs, not on the page.
4. **Is it a status that only matters when something is wrong?** Show it only in that case (`Not funded`, `Overspent`), never its all-clear twin.
5. **Is it a sentence where a fragment works?** Prefer `$59.98 monthly, due 1st` to a sentence.
6. **Is it shown on a device where it cannot apply?** Touch-only or install hints on a laptop, keyboard hints on a phone.
7. **Do two strings on one screen disagree, or name one action two ways?** The menu item, the button, and the result use the same verb.

Errors and destructive confirmations get more room: say what failed or what will be lost, and how to retry. `Budge couldn't save that. Try again.` is the house form.

## Report

One row per finding: `file:line`, the string, the question number it fails, and a suggested cut or rewrite. Opus records a disposition for each (cut, rewritten, kept with a reason) in the ticket.
