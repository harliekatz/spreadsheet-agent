# Architecture

Next.js App Router with `output: "export"`, so the build is a static bundle with
no server. React 19, TypeScript in strict mode, no state library.

```
src/
├── lib/
│   ├── query.ts       request -> QueryPlan -> rows, in two separate phases
│   ├── data.ts        the synthetic catalog and its field metadata
│   ├── provenance.ts  resolves a cell to its source
│   ├── samples.ts     seeded sheets, built by running real requests
│   ├── csv.ts         export
│   ├── importDocument.ts  docx, csv, tsv and txt ingest
│   └── insights.ts    the one line summary on a sheet card
├── hooks/
│   ├── useWorkspace.ts      sheets, undo and redo, persistence
│   ├── useGeneration.ts     the interpret, review, build sequence
│   └── useAssistantPanel.ts panel width and resize
└── components/        presentation
```

## The two phase interpreter

`buildPlan()` reads the request and returns a `QueryPlan`. It reads no rows. It
decides only which filters, sort, limit and columns apply.

`executePlan()` applies that plan to a set of rows.

Keeping these apart is what makes the rest work. The plan is a plain object, so
it can be rendered for review, edited by the user, attached to the saved sheet
and replayed later. If the first phase were replaced by a model call, the second
phase, the grid and the source panel would not change.

```ts
const plan = buildPlan(request);   // no rows read
const rows = executePlan(plan, products);
```

## The build sequence

`useGeneration` moves through five phases.

`idle` to `interpreting` to `review` to `building` to `ready`

The `review` phase is a stop. The plan renders with its source, filters,
columns, sort and limit, each editable, with actions to discard or build. Rows
are appended in batches during `building` so the sheet fills visibly rather than
appearing at once.

Editing an existing sheet uses a separate path. `proposeEdit()` produces a
change preview, `applyEdit()` commits it, and the commit is undoable.

## Two details worth knowing

**Executed rows are copied.** `executePlan` clones each surviving row. Without
the copy, a sheet would hold references into the shared catalog and editing one
cell would change the dataset for every other sheet built from the same record.

**Catalog fallback is disabled when editing.** Creating a sheet from scratch can
fall back to the whole catalog when the request is broad. Editing cannot. A
command the interpreter does not understand must not silently replace the rows
already in the sheet.

## Storage

Sheets persist to `localStorage` under a versioned key. Seeded sample sheets
carry a `SEED_VERSION`. When that constant changes, seeded sheets refresh on
next load while sheets the user created are kept. Every read is wrapped, since
`localStorage` throws in a private window and can return content written by an
older build.
