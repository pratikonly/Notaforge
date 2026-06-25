
ALTER TABLE public.folders ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;

CREATE POLICY "Anyone can view folders"
  ON public.folders FOR SELECT
  USING (is_deleted = false);

CREATE POLICY "Admins can create folders"
  ON public.folders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update folders"
  ON public.folders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete folders"
  ON public.folders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.folders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
