-- =========================================
-- STORAGE SETUP: DOCX TEMPLATES
-- =========================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('docx-templates', 'docx-templates', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Admins to upload templates
-- We check if the user is an admin by looking at public.users roles
CREATE POLICY "Admins can upload templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'docx-templates' AND
  EXISTS (
    SELECT 1 FROM public.users
    JOIN public.roles ON public.users.role_id = public.roles.id
    WHERE public.users.id = auth.uid()
    AND public.roles.name IN ('admin', 'super_admin')
  )
);

-- 3. Allow Admins to update their templates
CREATE POLICY "Admins can update templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'docx-templates' AND
  EXISTS (
    SELECT 1 FROM public.users
    JOIN public.roles ON public.users.role_id = public.roles.id
    WHERE public.users.id = auth.uid()
    AND public.roles.name IN ('admin', 'super_admin')
  )
);

-- 4. Allow Authenticated users to read templates
CREATE POLICY "Users can read templates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'docx-templates'
);

-- 5. Allow Admins to delete templates
CREATE POLICY "Admins can delete templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'docx-templates' AND
  EXISTS (
    SELECT 1 FROM public.users
    JOIN public.roles ON public.users.role_id = public.roles.id
    WHERE public.users.id = auth.uid()
    AND public.roles.name IN ('admin', 'super_admin')
  )
);
