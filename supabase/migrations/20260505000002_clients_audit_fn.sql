-- Helper RPC: atomically append one entry to clients.audit_trail
-- Called from the attachments API route after a successful upload.

CREATE OR REPLACE FUNCTION public.array_append_audit(
  client_id_input UUID,
  entry           TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.clients
  SET audit_trail = array_append(audit_trail, entry),
      updated_at  = now()
  WHERE id = client_id_input;
END;
$$;
