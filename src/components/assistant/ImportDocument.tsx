"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload, X, LoaderCircle, FileText } from "lucide-react";
import { readDocument, type ImportedDocument } from "@/lib/importDocument";
export function ImportDocument({
  busy,
  onBuild,
}: {
  busy: boolean;
  onBuild: (doc: ImportedDocument) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ImportedDocument | null>(null),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  async function choose(file: File) {
    setOpen(true);
    setError("");
    setDocument(null);
    setReading(true);
    try {
      const doc = await readDocument(file);
      setDocument(doc);
      setSelected(doc.columns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that document.");
    } finally {
      setReading(false);
    }
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        hidden
        accept=".docx,.csv,.tsv,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void choose(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className="import-trigger"
        disabled={busy || reading}
        onClick={() => input.current?.click()}
      >
        <Upload size={14} />
        Import document
      </button>
      {open &&
        createPortal(
          <div className="import-overlay">
            <section
              className="import-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Import document"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Tab") {
                  const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                    "button:not(:disabled),input",
                  );
                  const first = nodes[0],
                    last = nodes[nodes.length - 1];
                  if (e.shiftKey && documentGlobal.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                  } else if (!e.shiftKey && documentGlobal.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                  }
                }
              }}
            >
              <header>
                <h2>Import document</h2>
                <button
                  autoFocus
                  className="icon-button"
                  aria-label="Close import"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </header>
              <p>Review the extracted information before building your sheet.</p>
              <small>
                DOCX, CSV, TSV or TXT · up to 5 MB · use sample data, not anything
                confidential
              </small>
              {reading && (
                <p role="status">
                  <LoaderCircle size={16} className="spin" /> Reading document…
                </p>
              )}
              {error && (
                <p role="alert" className="composer-error">
                  {error}
                </p>
              )}
              {document && (
                <>
                  <div className="import-source">
                    <FileText size={18} />
                    <strong>{document.name}</strong>
                    <span>{document.rows.length} rows</span>
                  </div>
                  <fieldset>
                    <legend>Columns to include</legend>
                    {document.columns.map((c) => (
                      <label key={c}>
                        <input
                          type="checkbox"
                          checked={selected.includes(c)}
                          onChange={() =>
                            setSelected((prev) =>
                              prev.includes(c) ? prev.filter((v) => v !== c) : [...prev, c],
                            )
                          }
                        />
                        {c}
                      </label>
                    ))}
                  </fieldset>
                  <div className="import-preview">
                    <table>
                      <thead>
                        <tr>
                          {selected.map((c) => (
                            <th key={c}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {document.rows.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            {selected.map((c) => (
                              <td key={c}>{r[c]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="import-note">
                    Extracted in your browser from {document.method.toLowerCase()}. The file
                    is never uploaded. Extraction is structural, not a model reading your
                    document. The resulting sheet is stored in this browser until you delete
                    it.
                  </p>
                </>
              )}
              <footer>
                <button
                  className="button secondary"
                  disabled={reading}
                  onClick={() => input.current?.click()}
                >
                  Choose {document ? "another file" : "file"}
                </button>
                <button
                  className="button primary"
                  disabled={!document || !selected.length || reading || busy}
                  onClick={() => {
                    if (document) {
                      setOpen(false);
                      void onBuild({
                        ...document,
                        columns: document.columns.filter((c) => selected.includes(c)),
                      });
                    }
                  }}
                >
                  Build spreadsheet
                </button>
              </footer>
            </section>
          </div>,
          window.document.body,
        )}
    </>
  );
}
const documentGlobal =
  typeof window === "undefined" ? { activeElement: null } : window.document;
