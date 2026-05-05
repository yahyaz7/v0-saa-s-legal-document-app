-- All firm members (admin + staff) get identical access to clients and
-- client attachments. Previous policies were admin-only for DELETE.

-- ── clients ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;

CREATE POLICY "Firm members can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
  );

-- ── client_attachments ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can delete attachments" ON public.client_attachments;

CREATE POLICY "Firm members can delete attachments"
  ON public.client_attachments FOR DELETE
  TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
  );

-- ── storage.objects ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can delete client attachments" ON storage.objects;

CREATE POLICY "Firm members can delete client attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::TEXT FROM public.users WHERE id = auth.uid()
    )
  );
