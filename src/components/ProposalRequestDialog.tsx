import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getStoneSummary } from "../lib/proposalRequests";
import type { RequestColumns, RequestType, StoneSelection } from "../lib/proposalRequests";
import type { RapRow } from "../lib/types";

type Props = {
  open: boolean;
  slug: string;
  customerName: string;
  rows: RapRow[];
  columns: RequestColumns;
  selections: Record<number, StoneSelection>;
  onChange: (rowIndex: number, selection: StoneSelection) => void;
  onClose: () => void;
  onSent: () => void;
};

export function ProposalRequestDialog({ open, slug, customerName, rows, columns, selections, onChange, onClose, onSent }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedIndices = Object.keys(selections).map(Number).sort((a, b) => a - b);

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);

  useEffect(() => {
    requestId.current = null;
    setError("");
  }, [selections, generalNotes, slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || selectedIndices.length === 0) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/outputs/${encodeURIComponent(slug)}/requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          selections: selectedIndices.map((rowIndex) => ({ rowIndex, ...selections[rowIndex] })),
          generalNotes,
        }),
      });
      const result = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "We couldn't send your request. Please try again.");
      setGeneralNotes("");
      requestId.current = null;
      onSent();
    } catch (failure) {
      setError(failure instanceof Error && !(failure instanceof SyntaxError)
        ? failure.message : "We couldn't confirm your request. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="proposal-request-dialog no-print"
      aria-labelledby="proposal-request-title"
      aria-describedby="proposal-request-description"
      onCancel={(event) => { if (submitting.current) event.preventDefault(); }}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="request-dialog-heading">
          <h2 id="proposal-request-title">Review your Memo/Hold request</h2>
          <button type="button" className="btn" onClick={onClose} disabled={busy} aria-label="Close request summary">Close</button>
        </div>
        <p id="proposal-request-description" className="p">
          Select Memo or Hold for each stone and add any comments. Your team at Shivani Gems will confirm availability and fulfillment.
        </p>
        <p><strong>Customer:</strong> {customerName.trim() || "Customer name not provided"}</p>

        <fieldset className="request-fields" disabled={busy}>
          <div className="tableWrap">
            <table className="request-summary-table">
              <thead>
                <tr>
                  <th scope="col">Stone ID</th>
                  <th scope="col">$/ct</th>
                  <th scope="col">Total price</th>
                  <th scope="col">Request</th>
                  <th scope="col">Comments</th>
                </tr>
              </thead>
              <tbody>
                {selectedIndices.map((rowIndex) => {
                  const stone = getStoneSummary(rows[rowIndex], columns);
                  const selection = selections[rowIndex];
                  const label = `${stone.styleNumber}, stone ${rowIndex + 1}`;
                  return (
                    <tr key={rowIndex}>
                      <td data-label="Stone ID">{stone.styleNumber}</td>
                      <td data-label="$/ct">{stone.perCarat}</td>
                      <td data-label="Total price">{stone.total}</td>
                      <td data-label="Request">
                        <select
                          aria-label={`Request for ${label}`}
                          value={selection.type}
                          onChange={(event) => onChange(rowIndex, { ...selection, type: event.target.value as RequestType })}
                        >
                          <option value="memo">Memo</option>
                          <option value="hold">Hold</option>
                        </select>
                      </td>
                      <td data-label="Comments">
                        <textarea
                          aria-label={`Comments for ${label}`}
                          placeholder="Optional stone comments"
                          maxLength={2000}
                          value={selection.comments}
                          onChange={(event) => onChange(rowIndex, { ...selection, comments: event.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="request-general-notes" htmlFor="request-general-notes">General notes (optional)</label>
          <textarea
            id="request-general-notes"
            placeholder="Anything else about your request?"
            maxLength={4000}
            value={generalNotes}
            onChange={(event) => setGeneralNotes(event.target.value)}
          />
        </fieldset>
        {error && <p className="request-error" role="alert">{error}</p>}
        <div className="request-dialog-actions">
          <span className="small">{selectedIndices.length} {selectedIndices.length === 1 ? "stone" : "stones"} selected</span>
          <button className="btn primary" type="submit" disabled={busy || selectedIndices.length === 0 || selectedIndices.length > 100}>
            {busy ? "Sending…" : "Submit request"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
