import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { useToast } from './use-toast';

export type NoteType = 'text' | 'image' | 'pdf' | 'video' | 'audio' | 'link' | 'file';

export interface Note {
  id: string;
  user_id: string | null;
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

export function usePublicNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const { toast } = useToast();
  // Track IDs we inserted ourselves so we don't double-add from the realtime event
  const localInsertIds = useRef<Set<string>>(new Set());

  const fetchNotes = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      setNotes((data || []) as Note[]);
    } catch (error: any) {
      console.error('Error fetching notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load notes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [toast]);

  // ── Realtime subscription ──────────────────────────────────────────────────
  useEffect(() => {
    fetchNotes();

    // IMPORTANT: For realtime to work, enable it in Supabase:
    // Dashboard → Table Editor → notes table → Enable Realtime (toggle on)
    // OR run: ALTER TABLE notes REPLICA IDENTITY FULL;
    // Unique channel name avoids conflicts when hot-reloading in dev
    const channel = supabase
      .channel(`notes-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: 'is_deleted=eq.false',
        },
        (payload) => {
          if (payload.event === 'INSERT') {
            const newNote = payload.new as Note;
            // Skip if we already added this note optimistically from our own device
            if (localInsertIds.current.has(newNote.id)) {
              localInsertIds.current.delete(newNote.id);
              return;
            }
            // Only show non-archived/deleted notes
            if (newNote.is_archived || newNote.is_deleted) return;
            setNotes(prev => {
              // Guard against duplicates
              if (prev.some(n => n.id === newNote.id)) return prev;
              return [newNote, ...prev];
            });
          }

          if (payload.event === 'UPDATE') {
            const updated = payload.new as Note;
            // If archived or soft-deleted, remove from list
            if (updated.is_archived || updated.is_deleted) {
              setNotes(prev => prev.filter(n => n.id !== updated.id));
              return;
            }
            setNotes(prev =>
              prev.map(n => n.id === updated.id ? updated : n)
            );
          }

          if (payload.event === 'DELETE') {
            const deleted = payload.old as { id: string };
            setNotes(prev => prev.filter(n => n.id !== deleted.id));
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // fetchNotes is stable (useCallback with [toast]) — safe dep
  }, [fetchNotes]);

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const createNote = useCallback(async (noteData: Partial<Note>) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: noteData.title || 'Untitled',
          content: noteData.content || '',
          note_type: noteData.note_type || 'text',
          file_url: noteData.file_url,
          file_name: noteData.file_name,
          link_url: noteData.link_url,
          color: noteData.color || 'default',
        })
        .select()
        .single();

      if (error) throw error;

      const created = data as Note;
      // Mark this ID as a local insert so the realtime INSERT event skips it
      localInsertIds.current.add(created.id);
      // Optimistic: add immediately for this device
      setNotes(prev => [created, ...prev]);
      toast({
        title: 'Note created',
        description: 'Your note has been saved.',
      });

      return created;
    } catch (error) {
      console.error('Error creating note:', error);
      toast({
        title: 'Error',
        description: 'Failed to create note',
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

      // Optimistic removal — realtime DELETE will also fire but setNotes guard handles duplicates
      setNotes(prev => prev.filter(note => note.id !== id));
      toast({
        title: 'Note deleted',
        description: 'Note has been removed.',
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
    try {
      const result = await uploadToCloudinary(file);
      if (!result) throw new Error('Upload returned no result');
      return result.url;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: error?.message || 'Failed to upload file. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const updateNote = useCallback(async (id: string, noteData: Partial<Note>) => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: noteData.title,
          content: noteData.content,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => prev.map(note => note.id === id ? (data as Note) : note));
      toast({
        title: 'Note updated',
        description: 'Your changes have been saved.',
      });

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

  return {
    notes,
    loading,
    realtimeConnected,
    createNote,
    updateNote,
    deleteNote,
    uploadFile,
    refetch: fetchNotes,
  };
}
