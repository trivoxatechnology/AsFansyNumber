import { API_BASE } from '../config/api';
import { fetchWithAuth } from './api';

/**
 * Write a log entry to wp_fn_upload_batches.
 *
 * DB columns (after cleanup):
 *   batch_id | file_name | operation_type | admin_name |
 *   total_records | operation_data | upload_time | status | table_name
 *
 * Dropped columns (no longer sent):
 *   operation_time, uploaded_by, record_id, record_ids
 */
export async function writeOperationLog({
  fileName      = 'Admin Operation',
  operationType = 'Operation',        // REQUIRED — always pass this
  operationData = '',
  totalRecords  = 0,
  tableName     = 'wp_fn_numbers',
  status        = 'completed',
  adminName     = '',
}) {
  const fallbackAdmin = localStorage.getItem('adminUsername') || 'Admin';
  const finalAdmin    = String(adminName || fallbackAdmin).trim() || 'Admin';

  const payload = {
    file_name:      fileName,
    operation_type: operationType,
    admin_name:     finalAdmin,
    operation_data: operationData,
    total_records:  Number.isFinite(totalRecords) ? totalRecords : 0,
    status,
    table_name:     tableName,
  };

  try {
    const response = await fetchWithAuth(`${API_BASE}/wp_fn_upload_batches`, {
      method: 'POST',
      body:   JSON.stringify(payload),
    });
    if (response && response.ok) return true;
    console.error('Operation log write failed. Status:', response?.status);
    return false;
  } catch (err) {
    console.error('Operation log write error:', err?.message);
    return false;
  }
}
