# Testing

Run with `npm test`. The suite uses the Node test runner through `tsx`, with no
test renderer, because the logic worth testing has no React in it.

```bash
npm test         # unit tests
npm run check    # typecheck, lint, test, build
```

Continuous integration runs the same `check` script on push, see
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## What the suite covers

| File | Covers |
| --- | --- |
| [`tests/query.test.ts`](../tests/query.test.ts) | Field, filter, sort and limit parsing. Both ranked limits such as "top 25" and capped limits such as "limit it to 100". Requests the interpreter does not understand. |
| [`tests/plan.test.ts`](../tests/plan.test.ts) | Plan construction and execution as separate steps, and that executed rows are copies rather than references into the catalog. |
| [`tests/provenance.test.ts`](../tests/provenance.test.ts) | Cell resolution across all five source kinds, edit detection against the source record, row reasons and column reasons. |
| [`tests/csv.test.ts`](../tests/csv.test.ts) | Quoting and escaping on export, including values containing commas and quotes. |
| [`tests/importDocument.test.ts`](../tests/importDocument.test.ts) | Matrix and text ingest, header detection, and files that produce no usable table. |
| [`tests/insights.test.ts`](../tests/insights.test.ts) | The single summary line chosen for a sheet card. |
| [`tests/layoutTransition.test.ts`](../tests/layoutTransition.test.ts) | Panel resize geometry. |

## Three bugs the tests caught

**Executed rows shared references with the catalog.** Editing one cell in one
sheet changed the value in every other sheet built from the same record.
`executePlan` now copies each surviving row.

**An unrecognized edit command could replace the sheet.** The catalog fallback
that helps when creating a sheet also applied when editing one, so a command
containing a broad word could swap the rows out. The fallback is now gated on
whether a sheet already exists.

**Undo was one commit behind.** History was pushed inside a state updater, which
ran during render. The previous state is now read from a ref synced in an effect.

## What the tests do not establish

The suite covers functional correctness of parsing, execution, source resolution
and file handling. It does not measure how often the interpreter understands a
request a real merchandiser would type, which would need a labeled set of real
requests. Interpreter coverage is described in
[limitations](limitations.md).
