import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
}

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchFolders = useCallback(async (parentId?: string | null) => {
    if (!user?.id) {
      setFolders([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let query = supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .eq('is_deleted', false);
      
      // If parentId is undefined, fetch root folders (null parent_id)
      if (parentId === undefined) {
        query = query.is('parent_id', null);
      } else if (parentId !== null) {
        query = query.eq('parent_id', parentId);
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      setFolders((data || []) as Folder[]);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load folders',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    if (user?.id) {
      fetchFolders();
    } else {
      setFolders([]);
      setLoading(false);
    }
  }, [user?.id, fetchFolders]);

  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('folders')
        .insert({
          user_id: user.id,
          name: name || 'Untitled Folder',
          parent_id: parentId || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      setFolders(prev => [data as Folder, ...prev]);
      toast({
        title: 'Folder created',
        description: 'Your folder has been created.',
      });
      
      return data as Folder;
    } catch (error) {
      console.error('Error creating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folder',
        variant: 'destructive',
      });
      return null;
    }
  }, [user?.id, toast]);

  const updateFolder = useCallback(async (id: string, updates: Partial<Folder>) => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      if (updates.is_archived === true || updates.is_deleted === true) {
        setFolders(prev => prev.filter(folder => folder.id !== id));
      } else {
        setFolders(prev => prev.map(folder => folder.id === id ? data as Folder : folder));
      }
      
      return data as Folder;
    } catch (error) {
      console.error('Error updating folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to update folder',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setFolders(prev => prev.filter(folder => folder.id !== id));
      toast({
        title: 'Folder deleted',
        description: 'Your folder has been removed.',
      });
      return true;
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete folder',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  const moveNoteToFolder = useCallback(async (noteId: string, folderId: string | null) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ folder_id: folderId })
        .eq('id', noteId);

      if (error) throw error;
      
      toast({
        title: folderId ? 'Note moved to folder' : 'Note removed from folder',
      });
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
    folders,
    loading,
    createFolder,
    updateFolder,
    deleteFolder,
    moveNoteToFolder,
    refetch: fetchFolders,
  };
}
