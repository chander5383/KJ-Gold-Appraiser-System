const supabase = require('../config/database');
const { generateCertNo, getNextCertNo, getFinancialYear } = require('../utils/certNumber');

/**
 * Fetch the live cert_prefix from the settings table.
 *
 * Called immediately before every certificate number is generated so that a
 * prefix change saved on the Settings page takes effect on the very next
 * certificate — no server restart and no re-login required.
 *
 * Falls back to 'KJ' only as a last resort; the seed script always inserts
 * a cert_prefix row so this branch should never be reached in practice.
 */
async function getSettingsCertPrefix() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'cert_prefix')
    .single();

  if (error || !data || !data.value) return 'KJ';
  return data.value;
}

// ===== GET ALL CERTIFICATES (with pagination, search, filters) =====
async function getCertificates(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'desc',
      financialYear = '',
      dateFrom = '',
      dateTo = '',
      bankName = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('certificates')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    // Search filter
    if (search) {
      query = query.or(
        `cert_no.ilike.%${search}%,borrower_name.ilike.%${search}%,account_no.ilike.%${search}%,father_name.ilike.%${search}%`
      );
    }

    // Financial year filter
    if (financialYear) {
      query = query.eq('financial_year', financialYear);
    }

    // Date range filter
    if (dateFrom) {
      query = query.gte('cert_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('cert_date', dateTo);
    }

    // Bank filter
    if (bankName) {
      query = query.eq('bank_name', bankName);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      certificates: (data || []).map(c => ({ ...c, certificate_type: detectCertType(c) })),
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count || 0) / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get certificates error:', err);
    res.status(500).json({ error: 'Failed to fetch certificates.' });
  }
}

// ===== GET SINGLE CERTIFICATE WITH ITEMS =====
async function getCertificate(req, res) {
  try {
    const { id } = req.params;

    // Get certificate
    const { data: cert, error: certError } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (certError || !cert) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    // Get items
    const { data: items, error: itemsError } = await supabase
      .from('certificate_items')
      .select('*')
      .eq('certificate_id', id)
      .order('sr_no', { ascending: true });

    if (itemsError) throw itemsError;

    res.json({
      ...cert,
      certificate_type: detectCertType(cert),
      items: items || []
    });
  } catch (err) {
    console.error('Get certificate error:', err);
    res.status(500).json({ error: 'Failed to fetch certificate.' });
  }
}

// ===== CREATE CERTIFICATE =====
async function createCertificate(req, res) {
  try {
    const data = req.body;

    // Generate cert number (EXACT Code.gs logic)
    const certPrefix = await getSettingsCertPrefix();
    const certNo = await generateCertNo(data.cert_date || data.date, certPrefix);
    const financialYear = getFinancialYear(data.cert_date || data.date);

    // Calculate totals from items
    const items = data.items || [];
    const totals = calculateTotals(items);

    // Insert certificate
    const certRecord = {
      cert_no: certNo,
      financial_year: financialYear,
      shop_name: data.shop_name || data.shopName || 'KRISHNA JEWELLER',
      shop_address: data.shop_address || data.shopAddress || '',
      bank_name: data.bank_name || data.bankName || '',
      branch: data.branch || '',
      state: data.state || '',
      account_no: data.account_no || data.accountNo || '',
      borrower_prefix: data.borrower_prefix || data.borrowerPrefix || 'Mr.',
      borrower_name: data.borrower_name || data.borrowerName || '',
      relation_type: data.relation_type || data.relationType || 'S/O',
      father_name: data.father_name || data.fatherName || '',
      address: data.address || '',
      appraiser_prefix: data.appraiser_prefix || data.appraiserPrefix || 'Ms.',
      appraiser_name: data.appraiser_name || data.appraiserName || '',
      gold_price: parseFloat(data.gold_price || data.goldPrice) || 0,
      cert_date: data.cert_date || data.date,
      grand_total: totals.value,
      total_pieces: totals.pieces,
      total_gross: totals.gross,
      total_stone: totals.stone,
      total_net: totals.net,
      total_wt_24ct: totals.wt24,
      total_wt_22ct: totals.wt22,
      created_by: req.user.id
    };

    const { data: insertedCert, error: certError } = await supabase
      .from('certificates')
      .insert(certRecord)
      .select()
      .single();

    if (certError) throw certError;

    // Insert items
    if (items.length > 0) {
      const itemRecords = items.map((item, index) => ({
        certificate_id: insertedCert.id,
        sr_no: index + 1,
        name: item.name || '',
        pieces: parseInt(item.pieces) || 0,
        gross: parseFloat(item.gross) || 0,
        stone: parseFloat(item.stone) || 0,
        net: parseFloat(item.net) || 0,
        carat: parseFloat(item.carat) || 0,
        wt_24ct: parseFloat(item.wt24 || item.wt_24ct) || 0,
        wt_22ct: parseFloat(item.wt22 || item.wt_22ct) || 0,
        value: parseFloat(item.value) || 0
      }));

      const { error: itemsError } = await supabase
        .from('certificate_items')
        .insert(itemRecords);

      if (itemsError) throw itemsError;
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'CREATE',
      entity_type: 'certificate',
      entity_id: insertedCert.id,
      details: { cert_no: certNo, borrower: certRecord.borrower_name },
      ip_address: req.ip
    });

    // Return full certificate with items
    res.status(201).json({
      ...insertedCert,
      items: items
    });
  } catch (err) {
    console.error('Create certificate error:', err);
    res.status(500).json({ error: 'Failed to create certificate: ' + err.message });
  }
}

// ===== UPDATE CERTIFICATE =====
async function updateCertificate(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;

    // Verify certificate exists
    const { data: existing, error: findError } = await supabase
      .from('certificates')
      .select('id, cert_no')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    // Calculate totals from items
    const items = data.items || [];
    const totals = calculateTotals(items);

    // Update certificate
    const updateData = {
      shop_name: data.shop_name || data.shopName,
      shop_address: data.shop_address || data.shopAddress,
      bank_name: data.bank_name || data.bankName,
      branch: data.branch,
      state: data.state,
      account_no: data.account_no || data.accountNo || '',
      borrower_prefix: data.borrower_prefix || data.borrowerPrefix,
      borrower_name: data.borrower_name || data.borrowerName,
      relation_type: data.relation_type || data.relationType,
      father_name: data.father_name || data.fatherName,
      address: data.address,
      appraiser_prefix: data.appraiser_prefix || data.appraiserPrefix,
      appraiser_name: data.appraiser_name || data.appraiserName,
      gold_price: parseFloat(data.gold_price || data.goldPrice) || 0,
      cert_date: data.cert_date || data.date,
      grand_total: totals.value,
      total_pieces: totals.pieces,
      total_gross: totals.gross,
      total_stone: totals.stone,
      total_net: totals.net,
      total_wt_24ct: totals.wt24,
      total_wt_22ct: totals.wt22
    };

    const { data: updatedCert, error: updateError } = await supabase
      .from('certificates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Delete existing items and re-insert
    await supabase
      .from('certificate_items')
      .delete()
      .eq('certificate_id', id);

    if (items.length > 0) {
      const itemRecords = items.map((item, index) => ({
        certificate_id: id,
        sr_no: index + 1,
        name: item.name || '',
        pieces: parseInt(item.pieces) || 0,
        gross: parseFloat(item.gross) || 0,
        stone: parseFloat(item.stone) || 0,
        net: parseFloat(item.net) || 0,
        carat: parseFloat(item.carat) || 0,
        wt_24ct: parseFloat(item.wt24 || item.wt_24ct) || 0,
        wt_22ct: parseFloat(item.wt22 || item.wt_22ct) || 0,
        value: parseFloat(item.value) || 0
      }));

      await supabase.from('certificate_items').insert(itemRecords);
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'UPDATE',
      entity_type: 'certificate',
      entity_id: id,
      details: { cert_no: existing.cert_no },
      ip_address: req.ip
    });

    res.json({ ...updatedCert, items });
  } catch (err) {
    console.error('Update certificate error:', err);
    res.status(500).json({ error: 'Failed to update certificate.' });
  }
}

// ===== DELETE CERTIFICATE (HARD — PERMANENT, NOT RECOVERABLE) =====
//
// Removes the certificate and every child row from the database for good.
// This replaced a soft delete (`UPDATE certificates SET is_deleted = true`),
// which hid the row from the API while leaving it — and its certificate_items
// — in the database forever.
//
// Atomicity: the Supabase REST client sends one HTTP request per statement and
// cannot open a transaction, so the child+parent deletes are pushed into the
// `hard_delete_certificate` plpgsql function (see
// database/migrations/001_hard_delete_certificate.sql), which runs inside a
// single implicit transaction and rolls back entirely if any delete fails.
// If that function has not been installed yet, deleteViaCascade() below is
// used instead — a single DELETE statement whose FK cascade is likewise
// all-or-nothing.
async function deleteCertificate(req, res) {
  const { id } = req.params;

  try {
    // Deliberately NOT filtered by is_deleted: rows soft-deleted by the old
    // implementation are still physically present and must be purgeable.
    const { data: cert, error: findError } = await supabase
      .from('certificates')
      .select('id, cert_no')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;
    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    let itemsDeleted = null;
    let strategy = 'rpc_transaction';

    const { data: rpcData, error: rpcError } = await supabase
      .rpc('hard_delete_certificate', { p_cert_id: id });

    if (rpcError) {
      if (isMissingFunction(rpcError)) {
        // Migration not applied on this database — fall back and warn loudly.
        console.warn(
          '[delete] hard_delete_certificate() not found — falling back to ' +
          'cascading delete. Apply database/migrations/001_hard_delete_certificate.sql.'
        );
        strategy = 'cascade_fallback';
        itemsDeleted = await deleteViaCascade(id);
      } else if (/CERTIFICATE_NOT_FOUND/.test(rpcError.message || '')) {
        // Raced with another delete between the lookup above and the RPC.
        return res.status(404).json({ error: 'Certificate not found.' });
      } else {
        // A real failure inside the function: the transaction already rolled
        // back, so nothing was deleted. Surface the actual database error.
        throw rpcError;
      }
    } else {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      itemsDeleted = row?.items_deleted ?? null;
    }

    // Post-delete verification. Do not report success on the word of the write
    // call alone — confirm the parent and every child row are actually gone.
    const { data: stillThere, error: verifyError } = await supabase
      .from('certificates')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (verifyError) throw verifyError;
    if (stillThere) {
      throw new Error(
        `Certificate ${cert.cert_no} still exists in the database after delete.`
      );
    }

    const { count: orphanCount, error: orphanError } = await supabase
      .from('certificate_items')
      .select('id', { count: 'exact', head: true })
      .eq('certificate_id', id);

    if (orphanError) throw orphanError;
    if (orphanCount > 0) {
      throw new Error(
        `${orphanCount} certificate_items row(s) survived deletion of ${cert.cert_no}.`
      );
    }

    // Audit trail only after the delete is confirmed. activity_logs.entity_id
    // is a plain VARCHAR with no FK to certificates, so the log outlives the
    // record it describes — which is the point of an audit trail.
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'DELETE',
      entity_type: 'certificate',
      entity_id: id,
      details: {
        cert_no: cert.cert_no,
        delete_type: 'hard',
        strategy,
        items_deleted: itemsDeleted
      },
      ip_address: req.ip
    });

    res.json({
      message: `Certificate ${cert.cert_no} permanently deleted.`,
      id,
      cert_no: cert.cert_no,
      deleted: true,
      items_deleted: itemsDeleted
    });
  } catch (err) {
    console.error('Delete certificate error:', err);
    // Return the real backend error, not a generic string — the UI shows it.
    res.status(500).json({
      error: 'Failed to delete certificate: ' + describeDbError(err)
    });
  }
}

// Fallback path used only when hard_delete_certificate() is not installed.
// A single DELETE on the parent is atomic and its ON DELETE CASCADE takes the
// children with it, so there is no window in which children are gone but the
// parent survives. Returns the number of child rows removed.
async function deleteViaCascade(id) {
  const { count: itemCount } = await supabase
    .from('certificate_items')
    .select('id', { count: 'exact', head: true })
    .eq('certificate_id', id);

  const { error: parentError } = await supabase
    .from('certificates')
    .delete()
    .eq('id', id);

  if (!parentError) return itemCount ?? 0;

  // 23503 = foreign_key_violation: a child table without ON DELETE CASCADE is
  // holding the parent down. Clear children first, then retry the parent.
  if (parentError.code !== '23503') throw parentError;

  const { error: childError } = await supabase
    .from('certificate_items')
    .delete()
    .eq('certificate_id', id);

  if (childError) throw childError;

  const { error: retryError } = await supabase
    .from('certificates')
    .delete()
    .eq('id', id);

  if (retryError) throw retryError;

  return itemCount ?? 0;
}

// PostgREST reports an unknown RPC as PGRST202 / 404.
function isMissingFunction(error) {
  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    /could not find the function/i.test(error?.message || '')
  );
}

// Supabase errors carry the useful text across several fields.
function describeDbError(err) {
  if (!err) return 'Unknown error.';
  const parts = [err.message, err.details, err.hint].filter(Boolean);
  return parts.length ? parts.join(' — ') : String(err);
}

// ===== PREVIEW NEXT CERT NUMBER =====
async function previewNextCertNo(req, res) {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required.' });
    }

    const certPrefix = await getSettingsCertPrefix();
    const certNo = await getNextCertNo(date, certPrefix);
    res.json({ certNo });
  } catch (err) {
    console.error('Preview cert no error:', err);
    res.status(500).json({ error: 'Failed to generate certificate number.' });
  }
}

// ===== SEARCH CERTIFICATES =====
async function searchCertificates(req, res) {
  try {
    const { query, type = 'all' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const searchTerm = query.trim();
    let results = [];

    if (type === 'cert_no' || type === 'all') {
      // EXACT same search logic as Code.gs searchByCertNo
      const { data: certs } = await supabase
        .from('certificates')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (certs) {
        const normalizedQuery = searchTerm.replace(/\s+/g, '').toUpperCase();

        for (let i = 0; i < certs.length; i++) {
          const cert = certs[i];
          const certNoNorm = String(cert.cert_no).trim().replace(/\s+/g, '').toUpperCase();
          const lastPart = certNoNorm.split('/').pop();

          if (
            certNoNorm === normalizedQuery ||
            lastPart === normalizedQuery ||
            Number(lastPart) === Number(normalizedQuery)
          ) {
            // Get items for this certificate
            const { data: items } = await supabase
              .from('certificate_items')
              .select('*')
              .eq('certificate_id', cert.id)
              .order('sr_no', { ascending: true });

            results.push({ ...cert, certificate_type: detectCertType(cert), items: items || [] });
            break; // Return first match (same as original)
          }
        }
      }
    }

    // Extended search by other fields
    if (results.length === 0 && type === 'all') {
      const { data: certs } = await supabase
        .from('certificates')
        .select('*')
        .eq('is_deleted', false)
        .or(
          `borrower_name.ilike.%${searchTerm}%,account_no.ilike.%${searchTerm}%,cert_no.ilike.%${searchTerm}%`
        )
        .order('created_at', { ascending: false })
        .limit(20);

      if (certs && certs.length > 0) {
        for (const cert of certs) {
          const { data: items } = await supabase
            .from('certificate_items')
            .select('*')
            .eq('certificate_id', cert.id)
            .order('sr_no', { ascending: true });

          results.push({ ...cert, certificate_type: detectCertType(cert), items: items || [] });
        }
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
}

// ===== DUPLICATE CERTIFICATE =====
async function duplicateCertificate(req, res) {
  try {
    const { id } = req.params;

    // Get original
    const { data: original, error: findError } = await supabase
      .from('certificates')
      .select('*')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (findError || !original) {
      return res.status(404).json({ error: 'Certificate not found.' });
    }

    // Get items
    const { data: originalItems } = await supabase
      .from('certificate_items')
      .select('*')
      .eq('certificate_id', id)
      .order('sr_no', { ascending: true });

    // Create a new request body with original data
    req.body = {
      ...original,
      cert_date: new Date().toISOString().split('T')[0],
      items: (originalItems || []).map(item => ({
        name: item.name,
        pieces: item.pieces,
        gross: item.gross,
        stone: item.stone,
        net: item.net,
        carat: item.carat,
        wt24: item.wt_24ct,
        wt22: item.wt_22ct,
        value: item.value
      }))
    };

    // Use createCertificate to handle the rest
    await createCertificate(req, res);
  } catch (err) {
    console.error('Duplicate error:', err);
    res.status(500).json({ error: 'Failed to duplicate certificate.' });
  }
}

// ===== HELPER: Derive certificate_type from stored weight columns =====
// Simple certificates always save wt_24ct = wt_22ct = 0 on every item.
// Standard certificates have non-zero totals when any item has carat > 0.
// No schema change required — purely derived from existing data.
function detectCertType(cert) {
  return (Number(cert.total_wt_24ct) > 0 || Number(cert.total_wt_22ct) > 0)
    ? 'standard'
    : 'simple';
}

// ===== HELPER: Calculate totals from items =====
// EXACT same logic as Index.html getTotals()
function calculateTotals(items) {
  return items.reduce((acc, curr) => ({
    pieces: acc.pieces + (Number(curr.pieces) || 0),
    gross: acc.gross + (Number(curr.gross) || 0),
    stone: acc.stone + (Number(curr.stone) || 0),
    net: acc.net + (Number(curr.net) || 0),
    wt24: acc.wt24 + (Number(curr.wt24 || curr.wt_24ct) || 0),
    wt22: acc.wt22 + (Number(curr.wt22 || curr.wt_22ct) || 0),
    value: acc.value + (Number(curr.value) || 0),
  }), { pieces: 0, gross: 0, stone: 0, net: 0, wt24: 0, wt22: 0, value: 0 });
}

module.exports = {
  getCertificates,
  getCertificate,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  previewNextCertNo,
  searchCertificates,
  duplicateCertificate
};
