-- Drop existing restrictive upload policy
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;

-- Create policy to allow anyone to upload files to note-files bucket
CREATE POLICY "Anyone can upload note files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'note-files');

-- Allow anyone to update files in note-files bucket
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Anyone can update note files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'note-files');

-- Allow anyone to delete files in note-files bucket
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Anyone can delete note files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'note-files');