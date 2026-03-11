import { API_BASE } from '../config/api';
import { fetchWithAuth } from './api';

function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeIds(recordIds) {
  if (!Array.isArray(recordIds)) return [];
  return recordIds
    .filter((id) => id !== null && id !== undefined && String(id).trim() !== '')
    .slice(0, 500);
}

export function parseRecordIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeIds(value);
  if (typeof value !== 'string') return [];

  // Try JSON first
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return normalizeIds(parsed);
  } catch {
    // If not JSON, try splitting by comma
    const split = value.split(',').map(s => s.trim()).filter(Boolean);
    if (split.length > 0) return normalizeIds(split);
  }
  return [];
}

export async function writeOperationLog({
  fileName = 'Admin Operation',
  operationType = 'Operation',
  operationData = '',
  totalRecords = 0,
  tableName = 'wp_fn_numbers',
  recordId = null,
  recordIds = [],
  status = 'completed',
  adminName = '',
  uploadedBy = '',
}) {
  const fallbackAdmin = localStorage.getItem('adminUsername') || 'Admin';
  const finalAdmin = String(adminName || uploadedBy || fallbackAdmin).trim() || 'Admin';
  const normalizedIds = normalizeIds(recordIds);
  const now = new Date();

  const extendedPayload = {
    file_name: fileName,
    operation_type: operationType,
    admin_name: finalAdmin,
    operation_data: operationData,
    uploaded_by: finalAdmin,
    total_records: Number.isFinite(totalRecords) ? totalRecords : 0,
    status,
    table_name: tableName,
    record_id: recordId,
    record_ids: normalizedIds.length ? JSON.stringify(normalizedIds) : null,
    operation_time: toSqlDateTime(now),
  };

  const basePayload = {
    file_name: fileName,
    uploaded_by: finalAdmin,
    notes: `Operation: ${operationType}, ${operationData}, Operator: ${finalAdmin}`,
    total_records: Number.isFinite(totalRecords) ? totalRecords : 0,
    status,
  };

  // The ultimate fallback: just the raw `file_name` string containing everything, and total records.
  // This exactly matches the legacy schema processing logic in Dashboard.jsx
  const ultraFallbackPayload = {
    file_name: `${fileName}|||${finalAdmin}|||Operation: ${operationType}, ${operationData}`,
    total_records: Number.isFinite(totalRecords) ? totalRecords : 0
  };

  try {
    const response = await fetchWithAuth(`${API_BASE}/wp_fn_upload_batches`, {
      method: 'POST',
      body: JSON.stringify(extendedPayload),
    });
    if (response && response.ok) return true;
  } catch (err) {
    console.warn('Extended payload failed.');
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/wp_fn_upload_batches`, {
      method: 'POST',
      body: JSON.stringify(basePayload),
    });
    if (response && response.ok) return true;
  } catch (err) {
    console.warn('Base payload failed.');
  }

  try {
    const response = await fetchWithAuth(`${API_BASE}/wp_fn_upload_batches`, {
      method: 'POST',
      body: JSON.stringify(ultraFallbackPayload),
    });
    
    if (response && !response.ok) {
       console.error("Dashboard Log API completely rejected payload. Response:", await response.text());
    }
    return response ? response.ok : false;
  } catch (err) {
    console.error('Operation log write failed completely:', err?.message);
    return false;
  }
}
