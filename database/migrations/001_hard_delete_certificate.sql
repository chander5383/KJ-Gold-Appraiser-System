-- =============================================================================
-- 001 — HARD DELETE FOR CERTIFICATES (transactional)
-- =============================================================================
-- Additive migration. Creates ONE function. Does NOT alter any table, column,
-- index, constraint or trigger — existing schema is untouched.
--
-- WHY THIS EXISTS
-- ---------------
-- The backend talks to Postgres through the Supabase REST client
-- (@supabase/supabase-js), which issues one HTTP request per statement and
-- therefore cannot open a multi-statement transaction. Deleting the children
-- and then the parent as two REST calls has no atomicity: if the second call
-- fails, the items are already gone and the certificate is left orphaned.
--
-- A plpgsql function runs inside a single implicit transaction. Every DELETE
-- below either commits together or rolls back together. Any exception raised
-- (or any FK/permission error) aborts the whole function and rolls back.
--
-- HOW TO INSTALL
-- --------------
--   Supabase Dashboard -> SQL Editor -> New Query -> paste this file -> Run.
--
-- The API works without it (it falls back to a single cascading DELETE, which
-- is also atomic), but installing it gives the explicit child-then-parent
-- ordering with an auditable row count.
-- =============================================================================

CREATE OR REPLACE FUNCTION hard_delete_certificate(p_cert_id UUID)
RETURNS TABLE (cert_no VARCHAR, items_deleted INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cert_no       VARCHAR(50);
    v_items_deleted INTEGER := 0;
    v_certs_deleted INTEGER := 0;
BEGIN
    -- Lock the parent row for the life of the transaction so a concurrent
    -- update/delete cannot interleave between the child and parent deletes.
    SELECT c.cert_no INTO v_cert_no
    FROM certificates c
    WHERE c.id = p_cert_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CERTIFICATE_NOT_FOUND'
            USING ERRCODE = 'no_data_found';
    END IF;

    -- 1. CHILD RECORDS FIRST -------------------------------------------------
    -- certificate_items.certificate_id is ON DELETE CASCADE, so this is
    -- belt-and-braces, but it makes the ordering explicit and gives us a
    -- count to report. Add further child tables here as they are introduced.
    DELETE FROM certificate_items WHERE certificate_id = p_cert_id;
    GET DIAGNOSTICS v_items_deleted = ROW_COUNT;

    -- 2. PARENT RECORD -------------------------------------------------------
    DELETE FROM certificates WHERE id = p_cert_id;
    GET DIAGNOSTICS v_certs_deleted = ROW_COUNT;

    -- Nothing removed => something is wrong (RLS, race). Abort and roll the
    -- child delete above back rather than reporting a false success.
    IF v_certs_deleted <> 1 THEN
        RAISE EXCEPTION
            'HARD_DELETE_FAILED: expected to delete 1 certificate, deleted %',
            v_certs_deleted;
    END IF;

    cert_no       := v_cert_no;
    items_deleted := v_items_deleted;
    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION hard_delete_certificate(UUID) IS
    'Permanently removes a certificate and all of its child rows in one '
    'transaction. Raises (and therefore rolls back) if the certificate does '
    'not exist or if the parent delete does not affect exactly one row.';

-- The API authenticates with the service role key; grant it explicitly so the
-- call does not depend on default PUBLIC execute privileges.
GRANT EXECUTE ON FUNCTION hard_delete_certificate(UUID) TO service_role;
