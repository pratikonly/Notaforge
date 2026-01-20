import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type NoteType = 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'link' | 'file';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  note_type: NoteType;
  file_url: string | null;
  file_name: string | null;
  link_url: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  color: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchNotes = useCallback(async (folderId?: string | null) => {
    if (!user?.id) {
      setNotes([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let query = supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .eq('is_deleted', false);
      
      // Filter by folder - if folderId is undefined, get ungrouped notes
      if (folderId === undefined) {
        query = query.is('folder_id', null);
      } else if (folderId !== null) {
        query = query.eq('folder_id', folderId);
      }
      
      const { data, error } = await query
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setNotes((data || []) as Note[]);
    } catch (error: any) {
      console.error('Error fetching notes:', {
        message: error?.message,
        details: error?.toString(),
        hint: error?.hint,
        code: error?.code
      });
      // Don't show toast for network errors on initial load
      if (error?.message !== 'TypeError: Failed to fetch') {
        toast({
          title: 'Error',
          description: 'Failed to load notes. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id) {
      fetchNotes();
    } else {
      setNotes([]);
      setLoading(false);
    }
  }, [user?.id, fetchNotes]);

  const createNote = useCallback(async (noteData: Partial<Note>) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
          title: noteData.title || 'Untitled',
          content: noteData.content || '',
          note_type: noteData.note_type || 'text',
          file_url: noteData.file_url,
          file_name: noteData.file_name,
          link_url: noteData.link_url,
          is_pinned: noteData.is_pinned || false,
          color: noteData.color || 'default',
        })
        .select()
        .single();

      if (error) throw error;
      
      setNotes(prev => [data as Note, ...prev]);
      toast({
        title: 'Note created',
        description: 'Your note has been saved securely.',
      });
      
      return data as Note;
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: 'Error',
        description: 'Failed to create note',
        variant: 'destructive',
      });
      return null;
    }
  }, [user?.id, toast]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // If note is now archived or deleted, remove it from the list instantly
      if (updates.is_archived === true || updates.is_deleted === true) {
        setNotes(prev => prev.filter(note => note.id !== id));
      } else {
        setNotes(prev => prev.map(note => note.id === id ? data as Note : note));
      }
      
      return data as Note;
    } catch (error) {
      console.error('Error updating note:', error);
      toast({
        title: 'Error',
        description: 'Failed to update note',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setNotes(prev => prev.filter(note => note.id !== id));
      toast({
        title: 'Note deleted',
        description: 'Your note has been removed.',
      });
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete note',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    if (!user?.id) {
      toast({
        title: 'Upload failed',
        description: 'You must be logged in to upload files',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${user.id}/${timestamp}-${sanitizedName}`;

      console.log('Uploading file:', fileName, 'Size:', file.size, 'Type:', file.type);

      const { data, error: uploadError } = await supabase.storage
        .from('note-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', data);

      const { data: urlData } = supabase.storage
        .from('note-files')
        .getPublicUrl(fileName);

      console.log('Public URL:', urlData.publicUrl);

      return urlData.publicUrl;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: error?.message || 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  }, [user?.id, toast]);

  const moveToFolder = useCallback(async (noteId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ folder_id: folderId })
        .eq('id', noteId);

      if (error) throw error;
      
      // Remove note from current list as it's moved
      setNotes(prev => prev.filter(note => note.id !== noteId));
      
      return true;
    } catch (error) {
      console.error('Error moving note:', error);
      toast({
        title: 'Error',
        description: 'Failed to move note',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
    uploadFile,
    moveToFolder,
    refetch: fetchNotes,
  };
}
