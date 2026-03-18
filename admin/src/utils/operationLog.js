import { API_BASE } from '../config/api';
import { fetchWithAuth } from './api';

/**
 * Write a log entry to wp_fn_upload_batches.
 *
 * DB columns:
 *   batch_id | file_name | operation_type | admin_name |
 *   total_records | operation_data | upload_time | status | table_name
 */
export async function writeOperationLog({
  fileName      = 'Admin Operation',
  operationType = 'Operation',
  operationData = '',
  totalRecords  = 0,
  tableName     = 'wp_fn_numbers',
  status        = 'completed',
  adminName     = '',
}) {
  const fallbackAdmin = localStorage.getItem('ag_admin_username') || 'Admin';
  const finalAdmin    = String(adminName || fallbackAdmin).trim() || 'Admin';

  // Use system date/time from user's browser
  const now = new Date();
  const systemTimestamp = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  const payload = {
    file_name:      fileName,
    operation_type: operationType,
    admin_name:     finalAdmin,
    operation_data: operationData,
    total_records:  Number.isFinite(totalRecords) ? totalRecords : 0,
    upload_time:    systemTimestamp,
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
