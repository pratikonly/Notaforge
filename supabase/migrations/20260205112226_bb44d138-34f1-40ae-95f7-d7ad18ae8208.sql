-- Allow public uploads to the 'public' folder in note-files bucket
CREATE POLICY "Allow public uploads to public folder"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'note-files' 
  AND (storage.foldername(name))[1] = 'public'
);

-- Allow public updates to files in public folder
CREATE POLICY "Allow public updates to public folder"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'note-files' 
  AND (storage.foldername(name))[1] = 'public'
);

-- Allow public deletes to files in public folder
CREATE POLICY "Allow public deletes from public folder"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'note-files' 
  AND (storage.foldername(name))[1] = 'public'
);