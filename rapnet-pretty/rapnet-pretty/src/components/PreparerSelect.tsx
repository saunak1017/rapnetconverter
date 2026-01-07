import type { Preparer } from "../lib/types";

const PREPARERS: Preparer[] = [
  { name: "Atit", email: "atit@shivanigems.com", ext: "16" },
  { name: "Saunak", email: "saunak@shivanigems.com", ext: "25" },
  { name: "Hiten", email: "hiten@shivanigems.com", ext: "17" },
  { name: "Mayur", email: "mayur@shivanigems.com", ext: "22" },
  { name: "Mehul", email: "mehul@shivanigems.com", ext: "20" }
];

export function PreparerSelect({
  value,
  onChange,
}: {
  value: Preparer | null;
  onChange: (p: Preparer | null) => void;
}) {
  return (
    <div>
      <div className="small" style={{ marginBottom: 8 }}>Prepared by</div>
      <select
        value={value?.name ?? ""}
        onChange={(e) => {
          const name = e.target.value;
          const found = PREPARERS.find((p) => p.name === name) ?? null;
          onChange(found);
        }}
      >
        <option value="">Select…</option>
        {PREPARERS.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name} | {p.email} | Extension {p.ext}
          </option>
        ))}
      </select>

      {value && (
        <div style={{ marginTop: 10 }} className="badge">
          {value.email} • Ext {value.ext}
        </div>
      )}
    </div>
  );
}
