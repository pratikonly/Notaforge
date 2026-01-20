-- Update RLS policies for notes table to allow public access (no authentication required)
-- First, drop all existing policies on notes
DROP POLICY IF EXISTS "Users can create their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;

-- Create new public access policies for notes (anyone can CRUD)
CREATE POLICY "Anyone can view notes" 
ON public.notes 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can create notes" 
ON public.notes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update notes" 
ON public.notes 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete notes" 
ON public.notes 
FOR DELETE 
USING (true);

-- Make user_id nullable since we won't require authentication
ALTER TABLE public.notes ALTER COLUMN user_id DROP NOT NULL;

-- Set a default value for user_id to null for anonymous notes
ALTER TABLE public.notes ALTER COLUMN user_id SET DEFAULT NULL;