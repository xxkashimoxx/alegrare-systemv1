import { supabase } from './supabase-client.js';

export const STOCK_FIELDS = 'id,name,category,unit,quantity,minimum_quantity,lot_code,supplier,expires_on,unit_price';

export async function loadClinicStock(clinicId) {
  const rows = [], pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('stock_items').select(STOCK_FIELDS)
      .eq('clinic_id', clinicId).order('name').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
