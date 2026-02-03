-- Fix notes table: Restore proper RLS policies
DROP POLICY IF EXISTS "Anyone can view notes" ON notes;
DROP POLICY IF EXISTS "Anyone can create notes" ON notes;
DROP POLICY IF EXISTS "Anyone can update notes" ON notes;
DROP POLICY IF EXISTS "Anyone can delete notes" ON notes;

-- Create secure user-scoped policies for notes
CREATE POLICY "Users can view own notes" ON notes 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notes" ON notes 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes 
  FOR DELETE USING (auth.uid() = user_id);

-- Fix storage: Remove insecure public access policies
DROP POLICY IF EXISTS "Anyone can upload note files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update note files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete note files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- Create secure user-scoped storage policies
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'note-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'note-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'note-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'note-files' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Add missing DELETE policy for login_history
CREATE POLICY "Users can delete their own login history" ON login_history
  FOR DELETE USING (auth.uid() = user_id);