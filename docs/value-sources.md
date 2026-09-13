# Value sources

Every cell in a generated sheet can be resolved to where its value came from.
[`src/lib/provenance.ts`](../src/lib/provenance.ts) does this. Two related but
separate ideas are involved, and the README used to blur them.

## Five classifications in the model

`cellSource()` returns one of five kinds.

| Kind | Meaning |
| --- | --- |
| `dataset` | The value is unchanged from the catalog record. Carries the dataset, record id and field path. |
| `derived` | The value is unchanged and its field is calculated from other fields. Carries the formula, for example margin percent from cost and retail price. |
| `edited` | The value differs from the catalog record, or no matching record exists. Carries the previous value when one can be found. |
| `document` | The sheet was built from an imported file rather than the catalog. Carries the file name and column. |
| `empty` | No value in that cell. |

## Two markers in the grid

The grid does not paint five treatments. It marks two things and leaves the
rest unmarked.

| Treatment | Applied to |
| --- | --- |
| A dot in the column header and a tinted cell | `derived` |
| A corner mark on the cell | `edited` |
| No marker | `dataset`, `document` and `empty` |

Neither marker relies on color alone. The derived column carries a dot glyph in
its header and a `title` attribute naming the formula. The edited cell carries a
shape in the corner. Selecting any cell opens the source panel, which states the
kind in words regardless of which markers are visible.

## How an edit is detected

Edits are not stored per cell. A sheet keeps its rows, and each row keeps the
identifier of the record it came from. To classify a cell, the code looks up
that record in the catalog and compares the current value against the original.

```
value !== original            -> edited, with previousValue
value === original, derived   -> derived
value === original            -> dataset
```

This keeps sheets small and means a sheet stays classifiable after a reload,
since nothing depends on an edit log. It has three consequences worth knowing.

**An edit back to the original value stops reading as an edit.** If you change a
vendor name and then change it back, the comparison finds no difference and the
cell classifies as `dataset` again.

**A row with no matching record classifies as edited.** If the record id is
missing or the field is not part of the catalog, there is no original to compare
against, so the cell is reported as edited rather than claimed as dataset. This
is the conservative direction. It can over-report, and it never claims catalog
provenance for a value it cannot verify.

**Imported sheets skip the comparison entirely.** When `sheet.sourceFile` is
set, every cell resolves to `document` and reports the file and column. Imported
values are not checked against the catalog, so edits inside an imported sheet are
not distinguished from the file's own values.

## Row and column reasons

Alongside cell sources, the sheet keeps the query plan that built it. That gives
two more explanations.

- **Why this row.** The filter clauses the row satisfied, from `rowSource()`.
- **Why this column.** The reason the column was included, from
  `columnSource()`. Reasons include being named in the request, being a default
  identifying column, or coming from an imported document header.
