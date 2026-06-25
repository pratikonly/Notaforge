import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface Folder {
  id: string;
  name: string;
  color: string | null;
  user_id: string | null;
  parent_id: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchFolders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setFolders((data || []) as Folder[]);
    } catch (e) {
      console.error('Error fetching folders:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFolders();

    const channel = supabase
      .channel(`folders-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const f = payload.new as Folder;
            if (f.is_deleted || f.is_archived) return;
            setFolders(prev => prev.some(x => x.id === f.id) ? prev : [...prev, f]);
          } else if (payload.eventType === 'UPDATE') {
            const f = payload.new as Folder;
            if (f.is_deleted || f.is_archived) {
              setFolders(prev => prev.filter(x => x.id !== f.id));
            } else {
              setFolders(prev => prev.map(x => x.id === f.id ? f : x));
            }
          } else if (payload.eventType === 'DELETE') {
            const f = payload.old as { id: string };
            setFolders(prev => prev.filter(x => x.id !== f.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchFolders]);

  const createFolder = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('folders')
        .insert({ name: trimmed, user_id: userData.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      toast({ title: 'Folder created', description: `"${trimmed}" added.` });
      return data as Folder;
    } catch (e: any) {
      console.error('Error creating folder:', e);
      toast({
        title: 'Could not create folder',
        description: e?.message || 'Make sure you are logged in as admin.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('folders').delete().eq('id', id);
      if (error) throw error;
      setFolders(prev => prev.filter(f => f.id !== id));
      toast({ title: 'Folder deleted' });
      return true;
    } catch (e: any) {
      console.error('Error deleting folder:', e);
      toast({ title: 'Error', description: 'Failed to delete folder', variant: 'destructive' });
      return false;
    }
  }, [toast]);

  return { folders, loading, createFolder, deleteFolder, refetch: fetchFolders };
}
