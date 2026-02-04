-- Drop existing user-based RLS policies on notes table
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

-- Create new public access RLS policies
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