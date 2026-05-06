-- ─────────────────────────────────────────────────────────────────────────────
-- Audit Files
--
-- Allows admin users to store firm-level audit documents in a dedicated
-- private storage bucket.  Each file has a human-readable display name,
-- an optional expiry date, and full-row RLS tied to the uploading firm.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.audit_files (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       uuid        NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  uploaded_by   uuid        NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  display_name  text        NOT NULL CHECK (char_length(trim(display_name)) > 0),
  storage_path  text        NOT NULL UNIQUE,
  mime_type     text,
  file_size     bigint      NOT NULL DEFAULT 0,
  expires_at    date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast look-ups by firm and expiry
CREATE INDEX audit_files_firm_idx    ON public.audit_files (firm_id);
CREATE INDEX audit_files_expiry_idx  ON public.audit_files (expires_at) WHERE expires_at IS NOT NULL;

-- ── 2. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_files ENABLE ROW LEVEL SECURITY;

-- Only admins of the same firm may read audit files
CREATE POLICY "Admins can read own firm audit files"
  ON public.audit_files FOR SELECT
  TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Only admins may upload
CREATE POLICY "Admins can insert audit files"
  ON public.audit_files FOR INSERT
  TO authenticated
  WITH CHECK (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- Only admins may delete
CREATE POLICY "Admins can delete audit files"
  ON public.audit_files FOR DELETE
  TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- ── 3. Storage bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audit-files',
  'audit-files',
  false,          -- private: signed URLs required for download
  52428800,       -- 50 MB per file
  NULL            -- accept all mime types
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Storage RLS ────────────────────────────────────────────────────────────

-- SELECT (download via signed URL generation)
CREATE POLICY "Admins can read audit file objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audit-files'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::text FROM public.users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- INSERT (upload)
CREATE POLICY "Admins can upload audit file objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audit-files'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::text FROM public.users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );

-- DELETE
CREATE POLICY "Admins can delete audit file objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audit-files'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::text FROM public.users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid() AND r.name = 'admin'
    )
  );
