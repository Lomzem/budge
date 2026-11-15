# Independent UI recheck brief — UX efficiency

This is a neutral shared brief for fresh Sol A High, Sol B High and Opus 5.5 judges. Each independently assesses the same clean revision supplied in its assignment. Do not read earlier judges' reports, scores or verdicts, issue05, state.md, or ticket06 (historical score references). Use the spec, protocol/rubric/template, this brief, maintained feature map and actual source/app.

## Scope and evidence

- All26 accepted outcomes: [spec](spec.md). Required desktop1280x800 pointer, phone320x640 browser touch and keyboard completion of applicable tasks; targeted390px,1024px with panels,dark,longnames/largeamounts,empty/loading/error/held states. Do not require an unnecessary full cross-product, but complete the specific combinations below.
- Last code `0b01f27` (integrated `420daed`). Coordinator will pin the exact clean record commit after local source review. Backend/schema/admission source unchanged from independent32-call capacity pass atd824517. Repair implementor reports codegen/format/bothlinters/typecheck pass,933unit tests,fullisolatedE2E63pass. New local Standards/Spec/testaudit reviews must finish before commissioning.
- Fresh worktree perjudge, exclusive anonymousbackend/browser/session/evidence; verify-budge required lifecycle and cleanup. No source edits, commits, production access, further delegates or cross-judge communication.

## Tasks and expected observable outcomes

| Task | Items | Required tasks |
| --- | --- | --- |
| U1 Assign/fund | 1–2 | Edit Assigned directly on phone; fund underfunded and overspent Targets from table. Exact Assigned/Available/Ready to Assign effects and reload. Inspect all financial digits,labels and controls at320,390 anddesktop. |
| U2 Cover/move | 3–5 | Cover exact shortfall from searched Category and Ready to Assign shortcut. Explicit From/To,swap,invalidamount,cancel/clear. Both balances/globaltotal correct,persisted. Successannouncement;Clear/Escape keep usefulfocus and donot unexpectedlyclose a dirtyform. |
| U3 Organize | 6–10 | Add chosenGroup and newGroup insideAddCategory;inlineCategory/Groupnames;renamefailure/retry preserves anotherrow's unsentdraft;directCategory/Groupreorder keyboard/touch offscreen with cancellation/secondfinger;inspectorrename/regroup/hide/delete. Persist correctnames,order andmoneyhistory. |
| U4 Navigate | 11–12 | Collapse preserves totals/overspendingcue and reload. Month/yearjump,cutoverboundary,immediatereopenkeyboard,arrows,currentmonth,deep links,reload,Back/Forward acrossSections retain correctviewedmonthandmonthlyAssigned. |
| U5 Review filters | 13–16 | Search Category and exactPayee(identity notfreetext),preset/customdates,foldedremovablechips preservingotherfilters,correctURL/rows/counts/reload/focus. Back/Forward acrossSections afterchangingfilters followingreload preserves lastviewedfilter. |
| U6 Fast entry | 17–18,20 | NamedAccountcompactcontext→Change to genuinely differentAccount;optionalMemo;Saveandaddanother keepsAccount/date,clearsnewamount/Payee/memo/Category,focusPayee. Repeatedsubmitwhileheld savesonce,lateclosedopening leavesnewdraftalone. NormalSave,AllAccounts,existingedit/populatedMemo stillwork,exactbalancesandreload. |
| U7 Split | 19 | EmptylineMemosrevealedonrequest,populatedmemosvisible;add/remove/restartlines,removalkeepsfocusnearremainingline;save/reload/reopen correctlineamounts/memos,parenttotal,AccountandCategoryeffects. |
| U8 Copy | 21–26 | Sign-inheading/controlskeptwithouttagline;Theme/Categoriesintroremoved;AddTargetwithoutNoTargetyet;SettingsDownloadCSVorJSON.;desktopemptyinspectorSelectaCategory. Preserve consequentialexportdetails and meaningfulaccessible names. |

## Mandatory reinspection and previously unexercised combinations

No prior score is a target or evidence. Observe all scoped tasks independently; retained final-SHA journeys can own their distinct adversarial contracts and manual driving fills genuine input/viewport gaps.

1. Month history reproduction: choose nextyearJune, reload, chooseJuly, navigateCategories, Back. ExpectJulyURL/headingandthecorrectJulyAssigned,thenForwardCategories. Repeat ordinarypointer,320touch,keyboard. Monthchoices may replaceonehistoryentry; theyneednotcreateoneentrypermonth. Also checkanalogousfilterreload→changepayee→leave→Back.
2. Amount readability: longCategoryname,999999.99savedAssigned,Dark,390px;reloadtheninspectinputandAvailableandGroupTotals in full (not merelynopageoverflow). Compare320/390/desktop and1024withsidebar+inspectoropen. Tablecontainerwidthgovernscolumnstacking; eachvalue appears once. Smaller visiblebuttons may have largercoarsepointerhitareas; measure/test actualtouchareasratherthanonlyboundingboxes.
3. Clean keyboard traversal of Targetsetup/funding and combineddatepreset/filter task, usingcorrect rovingradio/Select/Command input paths. Programmaticlocator.focus as the only accessproof is insufficient to replace this traversal.
4. At320touch: Change to a genuinely differentAccount;heldduplicate/lateentrysave;customFrom/To;fullsplitadd/remove/restart. Also fullkeyboard splitline lifecycle. Other-mode constituentproofdoesnotfillthese explicitcombinations. If your harnessrecipefails, distinguishit fromobservedproductfailureandcorrectrecipebeforeverdict;requiredgapsremainprovisional/blockapproval.
5. Verifychangedpolish: GroupAddtouch44px;tableTargettoucharea;splitremoveadjacentfocus;Cover/Move politeannouncements;MoveClear/Escapefocusandcancelbehavior.

## Fixtures, journeys and limits

Read affected verify-budge featuresbudget,categories,inspector,targets,transactions,search,splits,accounts,transfers,payees,settings,shell,auth,export. Expand exactmaintainedjourneynamesfromregistry (noCLIwildcardassumption). Include budget/large-amounts and month-jump;categories/manage,reorder,late-rename,failed-rename;inspector/move-money,cover-and-manage;targets/monthly;search/filters,phone;transactions/create,late-save,add-another,categorize,categorize-late,approve-phone;splits/lines,restart;copy-relatedexport/files,shell/navigate,settings/later-start as relevant. Use budget-with-accounts,bank-sync,empty-budget ormaintainedfixture. Inventeddataonly,usercontrolsforadditionalsetup.

The reportedphoneamountregressioncase is999999.99withseven-figureGroupTotals. Serveradmissionallowslargervalues;theimplementornoteslargerphonevaluesmaystillclip. Donotclaimuniversalamountreadabilityfromtheboundedcase;assessanyobservedgapagainsttaskscopeandrubrichonestly.

LivePlaid/ownerproductionlogin/physicalhardwareoutside localgate,notimplicitlyproven by mocks. Browser touch accepted; labelphysicalphoneunverified. Neverreadormutaterealbudgetdata. Allchangedlocaloutcomesremainrequired.

## Report and cleanup

Use docs/quality/ui-review/report-template.md in your own `test-results/ux-efficiency/ui-review-round-2/<judge>.md`. Includeactualmodel/effort,freshindependence,exactcleanSHA,readiness,task×viewport/input/persistence/evidencematrix,findingsseverity/repro,allrubricscores,separateoverallscoreandverdict,requiredgaps,cleanupandownershiprelease. Eachjudge must independentlyapprove>=9/fullcoverage/noopenmajorblocker atsamefinalSHA; neveraverageorinventscore.

Closebrowserfinally;appdownaftereveryattemptyoustarted;retainnonemptyscreenshot/ARIA/traceanddownloadproofwithoutauth/rawheaders/secrets. No sync/typecheck/check duringactivejourney. Parentdeterministiccapacity/unit/fullE2Eneednotbererunbyjudges. Report external/mocklimits precisely.
