
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Anyone can read active notes') THEN
    CREATE POLICY "Anyone can read active notes" ON public.notes FOR SELECT USING (is_archived = false AND is_deleted = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Anyone can insert notes') THEN
    CREATE POLICY "Anyone can insert notes" ON public.notes FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Admins can update notes') THEN
    CREATE POLICY "Admins can update notes" ON public.notes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notes' AND policyname='Admins can delete notes') THEN
    CREATE POLICY "Admins can delete notes" ON public.notes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
