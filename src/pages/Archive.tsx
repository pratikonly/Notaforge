import { useState, useEffect, useCallback } from 'react';
import { Archive as ArchiveIcon, RotateCcw, Folder as FolderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteCard } from '@/components/NoteCard';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Note } from '@/hooks/useNotes';
import { Folder } from '@/hooks/useFolders';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Archive() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const fetchArchived = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Fetch archived notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (notesError) throw notesError;
      setNotes((notesData || []) as Note[]);

      // Fetch archived folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', true)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (foldersError) throw foldersError;
      setFolders((foldersData || []) as Folder[]);
    } catch (error) {
      console.error('Error fetching archived items:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  const handleRestoreNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_archived: false })
        .eq('id', id);

      if (error) throw error;
      
      setNotes(prev => prev.filter(n => n.id !== id));
      toast({ title: 'Note restored', description: 'Note moved back to your vault' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRestoreFolder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('folders')
        .update({ is_archived: false })
        .eq('id', id);

      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== id));
      toast({ title: 'Folder restored' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;
    
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_deleted: true, is_archived: false })
        .eq('id', deleteNoteId);

      if (error) throw error;
      
      setNotes(prev => prev.filter(n => n.id !== deleteNoteId));
      setDeleteNoteId(null);
      toast({ title: 'Note moved to bin' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderId) return;
    
    try {
      const { error } = await supabase
        .from('folders')
        .update({ is_deleted: true, is_archived: false })
        .eq('id', deleteFolderId);

      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== deleteFolderId));
      setDeleteFolderId(null);
      toast({ title: 'Folder moved to bin' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Archive"
        description="Notes and folders you've archived"
        icon={<ArchiveIcon className="w-4 h-4 text-primary" />}
      />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 && folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <ArchiveIcon className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg sm:text-xl font-medium text-foreground mb-2">No archived items</h2>
            <p className="text-muted-foreground max-w-sm text-sm sm:text-base">
              Notes and folders you archive will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Archived Folders */}
            {folders.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-muted-foreground mb-3">Folders</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  {folders.map((folder) => (
                    <div key={folder.id} className="note-card rounded-xl p-3 sm:p-4 relative group">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 flex-shrink-0">
                          <FolderIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <span className="font-medium text-foreground truncate text-sm sm:text-base">{folder.name}</span>
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handleRestoreFolder(folder.id)}
                          title="Restore"
                        >
                          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archived Notes */}
            {notes.length > 0 && (
              <>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">Notes</h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {notes.map((note) => (
                    <div key={note.id} className="relative group">
                      <NoteCard
                        note={note}
                        onEdit={() => {}}
                        onDelete={() => setDeleteNoteId(note.id)}
                        onTogglePin={() => {}}
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => handleRestoreNote(note.id)}
                          title="Restore"
                        >
                          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Delete Note Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Bin</AlertDialogTitle>
            <AlertDialogDescription>
              This note will be moved to the bin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Move Folder to Bin</AlertDialogTitle>
            <AlertDialogDescription>
              This folder will be moved to the bin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
