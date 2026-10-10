-- Allows the clinic catalog to distinguish products, supplies and cleaning items.
-- Existing values ('material' and 'medication') remain valid.
begin;
alter table public.stock_items
  drop constraint if exists stock_items_category_check;
alter table public.stock_items
  add constraint stock_items_category_check
  check (category = any (array['material','medication','product','supply','cleaning']::text[]));
commit;
