# Limitations

**The interpreter understands a fixed vocabulary.** It matches field names,
comparison words, sort words and limit phrases from patterns in
[`src/lib/query.ts`](../src/lib/query.ts). A request outside those patterns
returns no plan and says so rather than guessing. There is no measurement of how
much real merchandising language that vocabulary covers.

**There is no model in the loop.** Interpretation is deterministic parsing. The
plan boundary is designed so a model could take over the first phase, but that
work is not done here.

**Sheets live in this browser.** State is held in `localStorage`, so progress
does not follow you to another device and clearing site data clears it. This
also means the app holds no user data anywhere else.

**The catalog is generated, not sampled.** 1,200 records from
[`src/lib/data.ts`](../src/lib/data.ts), with a fixed reference date so figures
are stable across runs. Distributions are hand shaped and are not drawn from a
real assortment.

**Edits are inferred by comparison, not recorded.** A value changed back to its
original stops reading as an edit, and a row with no matching catalog record
classifies as edited because there is nothing to compare against. See
[value sources](value-sources.md).

**Imported sheets are not reconciled against the catalog.** Every cell in an
imported sheet resolves to the file it came from, so edits inside an imported
sheet are not distinguished from the file's own values.

**Accessibility work is implemented but not automatically checked.** Keyboard
operation of the plan review and grid, focus handling, labeled controls, a skip
link and source markers that do not depend on color alone are all in the code
and can be read in the components. No accessibility linting or axe check runs in
continuous integration, and the app has not been tested with a screen reader, so
treat the implementation as present rather than verified.
