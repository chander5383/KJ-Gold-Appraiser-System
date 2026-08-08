/**
 * Certificate API Service
 * ========================
 * All certificate-related API calls in one place.
 * Extracted from CertificatePage.jsx and HistoryPage.jsx.
 * Uses the existing axios client from api/client.js.
 */

import api from '../api/client';

/**
 * Fetch the next available certificate number for a given date.
 * EXACT logic from CertificatePage fetchNextCertNo().
 *
 * @param {string} dateStr - Date string (yyyy-MM-dd)
 * @param {AbortSignal} [signal] - Optional abort signal for effect cleanup
 * @returns {Promise<string>} The next certificate number
 */
export async function fetchNextCertNo(dateStr, signal) {
  const res = await api.get('/certificates/next-number', { params: { date: dateStr }, signal });
  return res.data.certNo;
}

/**
 * Load a certificate by ID.
 * EXACT logic from CertificatePage loadCertificate().
 *
 * @param {string|number} certId - Certificate ID
 * @param {AbortSignal} [signal] - Optional abort signal for effect cleanup
 * @returns {Promise<Object>} The certificate data
 */
export async function loadCertificateById(certId, signal) {
  const res = await api.get(`/certificates/${certId}`, { signal });
  return res.data;
}

/**
 * Create a new certificate.
 * EXACT logic from CertificatePage saveCertificate() (POST branch).
 *
 * @param {Object} payload - Certificate data
 * @returns {Promise<Object>} The created certificate data (includes id, cert_no)
 */
export async function createCertificate(payload) {
  const res = await api.post('/certificates', payload);
  return res.data;
}

/**
 * Update an existing certificate.
 * EXACT logic from CertificatePage saveCertificate() (PUT branch).
 *
 * @param {string|number} id - Certificate ID
 * @param {Object} payload - Certificate data
 * @returns {Promise<Object>} The updated certificate data
 */
export async function updateCertificate(id, payload) {
  const res = await api.put(`/certificates/${id}`, payload);
  return res.data;
}

/**
 * Search certificates by query string.
 * EXACT logic from CertificatePage SearchBar handleSearch().
 *
 * @param {string} query - Search query (cert no, name, etc.)
 * @returns {Promise<Array>} Array of matching certificates
 */
export async function searchCertificates(query) {
  const res = await api.get('/certificates/search', { params: { query } });
  return res.data.results;
}

/**
 * Fetch paginated certificate list with filters.
 * From HistoryPage fetchCertificates().
 *
 * @param {Object} params - Query parameters (page, limit, sortBy, sortOrder, search, dateFrom, dateTo)
 * @returns {Promise<Object>} { certificates, pagination }
 */
export async function fetchCertificates(params) {
  const res = await api.get('/certificates', { params });
  return res.data;
}

/**
 * Delete a certificate by ID.
 * From HistoryPage handleDelete().
 *
 * @param {string|number} id - Certificate ID
 * @returns {Promise<void>}
 */
export async function deleteCertificate(id) {
  await api.delete(`/certificates/${id}`);
}

/**
 * Duplicate a certificate.
 * From HistoryPage handleDuplicate().
 *
 * @param {string|number} id - Certificate ID to duplicate
 * @returns {Promise<Object>} The duplicated certificate data
 */
export async function duplicateCertificate(id) {
  const res = await api.post(`/certificates/${id}/duplicate`);
  return res.data;
}
