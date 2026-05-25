import type { ReactNode } from "react";

export type Bilingual = { ar: string; en: string };

export type ColumnDef<T = any> = {
  key: string;
  label: Bilingual;
  render?: (value: any, row: T) => ReactNode;
  type?: "text" | "number" | "currency" | "date" | "datetime" | "badge" | "boolean" | "image";
  width?: string;
  hideOnMobile?: boolean;
};

export type SelectOption = { value: string; label: Bilingual };

export type FilterDef =
  | { key: string; type: "search"; placeholder?: Bilingual; columns: string[] }
  | { key: string; type: "select"; label: Bilingual; options: SelectOption[] }
  | { key: string; type: "date"; label: Bilingual };

export type FormFieldType =
  | "text" | "textarea" | "number" | "select" | "boolean" | "date" | "datetime"
  | "image" | "video" | "gallery" | "url" | "email" | "tel" | "color" | "json"
  | "videoGallery" | "warehouseStock"
  | "lookup"
  | "productVariants"
  | "productAttributes";

export type LookupJunctionConfig = {
  table: string;
  ownerColumn: string;
  itemColumn: string;
};

export type LookupConfig = {
  table: string;
  labelColumns?: readonly string[];
  secondaryColumn?: string;
  imageColumn?: string;
  searchColumns?: readonly string[];
  multiple?: boolean;
  limit?: number;
  filter?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
  junction?: LookupJunctionConfig;
};

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
  createOnly?: boolean;
  editOnly?: boolean;
  fullWidth?: boolean;
  bucket?: string;
  folder?: string;
  maxItems?: number;
  lookup?: LookupConfig;
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
  table: string;
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
  columns: ColumnDef<T>[];
  filters?: FilterDef[];
  form?: FormFieldDef[];
  actions?: { create?: boolean; edit?: boolean; delete?: boolean; export?: boolean };
  rowActions?: RowAction<T>[];
  select?: string;
  rowHref?: (row: T) => string;
  enrichRows?: (rows: T[]) => Promise<T[]> | T[];
};

export type DetailFieldType =
  | "text" | "longtext" | "number" | "currency" | "date" | "datetime"
  | "badge" | "boolean" | "image" | "url" | "email" | "tel" | "json" | "address";

export type DetailFieldDef<T = any> = {
  key: string;
  label: Bilingual;
  type?: DetailFieldType;
  render?: (value: any, row: T) => ReactNode;
  hideIfEmpty?: boolean;
  span?: 1 | 2 | 3;
};

export type DetailSectionDef<T = any> = {
  title: Bilingual;
  fields: DetailFieldDef<T>[];
  columns?: 1 | 2 | 3;
  sidebar?: boolean;
};

export type RelatedTableDef<T = any> = {
  title: Bilingual;
  table: string;
  foreignKey: string;
  foreignKeyValue?: (row: T) => string | undefined;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  columns: ColumnDef[];
  select?: string;
  extraEq?: Record<string, any>;
  rowHref?: (row: any) => string;
  footer?: (rows: any[], main: T) => ReactNode;
  emptyMessage?: Bilingual;
};

export type AdminDetailConfig<T = any> = {
  table: string;
  backTo: string;
  backLabel: Bilingual;
  title: (row: T) => Bilingual | string;
  description?: (row: T) => Bilingual | string;
  select?: string;
  sections: DetailSectionDef<T>[];
  related?: RelatedTableDef<T>[];
  editForm?: FormFieldDef[];
};
