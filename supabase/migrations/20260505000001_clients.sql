-- =============================================================================
-- CLIENTS MODULE
-- =============================================================================
-- Creates the clients table, client_attachments table, storage bucket for
-- attachments, and all required RLS policies.
--
-- Design decisions:
--   - clients are firm-scoped (firm_id FK → firms)
--   - audit_trail is TEXT[] — new entries are appended via array_append()
--   - attachments live in storage bucket "client-attachments" under the path
--     {firm_id}/{client_id}/{filename} and are tracked in client_attachments
--   - name + dob + ni_number together must be unique per firm to prevent
--     duplicate records for the same person
-- =============================================================================

-- ── 1. clients table ──────────────────────────────────────────────────────────

CREATE TABLE public.clients (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID        NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  created_by    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Core identity fields (required)
  full_name     TEXT        NOT NULL CHECK (char_length(trim(full_name)) > 0),
  date_of_birth DATE        NOT NULL,
  address       TEXT        NOT NULL CHECK (char_length(trim(address)) > 0),
  ni_number     TEXT        NOT NULL CHECK (char_length(trim(ni_number)) > 0),

  -- Optional fields
  status        TEXT        DEFAULT NULL,
  audit_trail   TEXT[]      NOT NULL DEFAULT '{}',

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate client records within the same firm
  UNIQUE (firm_id, full_name, date_of_birth, ni_number)
);

-- ── 2. client_attachments table ───────────────────────────────────────────────

CREATE TABLE public.client_attachments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  firm_id      UUID        NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  uploaded_by  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  file_name    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL, -- e.g. {firm_id}/{client_id}/{filename}
  mime_type    TEXT        DEFAULT NULL,
  file_size    BIGINT      DEFAULT NULL, -- bytes

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX idx_clients_firm_id        ON public.clients(firm_id);
CREATE INDEX idx_clients_ni_number      ON public.clients(firm_id, ni_number);
CREATE INDEX idx_client_attachments_client ON public.client_attachments(client_id);

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

-- Helper: returns the firm_id for the calling user (reuses existing pattern)
-- Uses the public.users table that already exists in this schema.

CREATE POLICY "Firm members can view clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING (
    firm_id = (
      SELECT firm_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Firm members can create clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    firm_id = (
      SELECT firm_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Firm members can update clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING (
    firm_id = (
      SELECT firm_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    firm_id = (
      SELECT firm_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Only admins can delete clients
CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING (
    firm_id = (
      SELECT firm_id FROM public.users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Attachments: same firm scope
CREATE POLICY "Firm members can view attachments"
  ON public.client_attachments FOR SELECT
  TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Firm members can insert attachments"
  ON public.client_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can delete attachments"
  ON public.client_attachments FOR DELETE
  TO authenticated
  USING (
    firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- ── 6. Storage bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-attachments', 'client-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Firm members can upload attachments to their firm's folder
CREATE POLICY "Firm members can upload client attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::TEXT FROM public.users WHERE id = auth.uid()
    )
  );

-- Firm members can read their firm's attachments
CREATE POLICY "Firm members can read client attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::TEXT FROM public.users WHERE id = auth.uid()
    )
  );

-- Only admins can delete attachments from storage
CREATE POLICY "Admins can delete client attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-attachments'
    AND (storage.foldername(name))[1] = (
      SELECT firm_id::TEXT FROM public.users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('admin', 'super_admin')
    )
  );
