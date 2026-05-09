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
