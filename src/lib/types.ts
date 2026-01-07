export type RapRow = Record<string, string | boolean>;

export type ColumnDef = {
  key: string;   // original header key in parsed data
  label: string; // display label
};

export type Preparer = {
  name: string;
  email: string;
  ext: string;
};

export type DraftState = {
  rawColumns: string[];
  columns: ColumnDef[]; // ordered & labeled
  rows: RapRow[];
  preparedFor: string;
  request: string;
  preparer: Preparer | null;
};
