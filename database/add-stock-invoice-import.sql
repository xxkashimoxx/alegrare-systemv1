-- Adds traceability and duplicate protection for stock items imported from invoices.
alter table public.stock_items
  add column if not exists product_code text,
  add column if not exists invoice_key text,
  add column if not exists invoice_item_number integer,
  add column if not exists invoice_source_name text;

alter table public.stock_items
  drop constraint if exists stock_items_invoice_item_number_check;

alter table public.stock_items
  add constraint stock_items_invoice_item_number_check
  check (invoice_item_number is null or invoice_item_number > 0);

alter table public.stock_items
  drop constraint if exists stock_items_invoice_line_unique;

alter table public.stock_items
  add constraint stock_items_invoice_line_unique
  unique (clinic_id, invoice_key, invoice_item_number);
