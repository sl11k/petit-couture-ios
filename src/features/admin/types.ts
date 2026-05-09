import type { ReactNode } from "react";

export type Bilingual = { ar: string; en: string };

export type ColumnDef<T = any> = {
  key: string;
  label: Bilingual;
  /** Optional custom renderer */
  render?: (value: any, row: T) => ReactNode;
  /** Format hint when no `render` provided */
  type?: "text" | "number" | "currency" | "date" | "datetime" | "badge" | "boolean" | "image";
  /** width hint in tailwind class form, e.g. "w-32" */
  width?: string;
  /** Hide on small screens */
  hideOnMobile?: boolean;
};

export type SelectOption = { value: string; label: Bilingual };

export type FilterDef =
  | { key: string; type: "search"; placeholder?: Bilingual; columns: string[] }
  | { key: string; type: "select"; label: Bilingual; options: SelectOption[] }
  | { key: string; type: "date"; label: Bilingual };

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "boolean"
  | "date"
  | "datetime"
  | "image"
  | "url"
  | "email"
  | "tel"
  | "color"
  | "json";

export type FormFieldDef = {
  key: string;
  label: Bilingual;
  type: FormFieldType;
  required?: boolean;
  options?: SelectOption[];
  placeholder?: Bilingual;
  defaultValue?: any;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  maxLength?: number;
  pattern?: string;
  helpText?: Bilingual;
  /** Show field only when creating */
  createOnly?: boolean;
  /** Show field only when editing */
  editOnly?: boolean;
  /** Take full row width (default true for textarea/json) */
  fullWidth?: boolean;
};

export type RowAction<T = any> = {
  key: string;
  label: Bilingual;
  icon?: ReactNode;
  to?: (row: T) => string;
  onClick?: (row: T) => void | Promise<void>;
  variant?: "default" | "danger";
};

export type AdminPageConfig<T = any> = {
  title: Bilingual;
  description?: Bilingual;
  /** Supabase table name */
  table: string;
  /** Default order column */
  orderBy?: { column: string; ascending?: boolean };
  /** Page size for client-side pagination */
  pageSize?: number;
  columns: ColumnDef<T>[];
  filters?: FilterDef[];
  form?: FormFieldDef[];
  actions?: {
    create?: boolean;
    edit?: boolean;
    delete?: boolean;
    export?: boolean;
  };
  rowActions?: RowAction<T>[];
  /** Custom select clause; defaults to "*" */
  select?: string;
  /** Click row navigates to */
  rowHref?: (row: T) => string;
};

export type DetailFieldType =
  | "text" | "longtext" | "number" | "currency" | "date" | "datetime"
  | "badge" | "boolean" | "image" | "url" | "email" | "tel" | "json" | "address";

export type DetailFieldDef<T = any> = {
  key: string;
  label: Bilingual;
  type?: DetailFieldType;
  /** Custom renderer */
  render?: (value: any, row: T) => ReactNode;
  /** Hide field if value is empty */
  hideIfEmpty?: boolean;
  /** Span columns inside its section */
  span?: 1 | 2 | 3;
};

export type DetailSectionDef<T = any> = {
  title: Bilingual;
  fields: DetailFieldDef<T>[];
  /** Number of columns inside this section (sm+) */
  columns?: 1 | 2 | 3;
  /** Place section in the sidebar instead of main column */
  sidebar?: boolean;
};

export type RelatedTableDef<T = any> = {
  title: Bilingual;
  table: string;
  /** Foreign key column on the related table */
  foreignKey: string;
  /** How to compute the FK value from the main row (default: row.id) */
  foreignKeyValue?: (row: T) => string | undefined;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  columns: ColumnDef[];
  select?: string;
  rowHref?: (row: any) => string;
  /** Footer renderer (e.g. totals) */
  footer?: (rows: any[], main: T) => ReactNode;
  /** Empty state */
  emptyMessage?: Bilingual;
};

export type AdminDetailConfig<T = any> = {
  /** Supabase table for the main entity */
  table: string;
  /** Path back to the listing */
  backTo: string;
  backLabel: Bilingual;
  title: (row: T) => Bilingual | string;
  description?: (row: T) => Bilingual | string;
  /** Custom select for main row (default "*") */
  select?: string;
  /** Sections (sidebar:true sections render in side column) */
  sections: DetailSectionDef<T>[];
  related?: RelatedTableDef<T>[];
  /** Optional inline edit using FormDialog */
  editForm?: FormFieldDef[];
};
