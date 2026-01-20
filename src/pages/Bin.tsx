import { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Folder as FolderIcon } from 'lucide-react';
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

export default function Bin() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [emptyBinOpen, setEmptyBinOpen] = useState(false);

  const fetchDeleted = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Fetch deleted notes
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      if (notesError) throw notesError;
      setNotes((notesData || []) as Note[]);

      // Fetch deleted folders
      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false });

      if (foldersError) throw foldersError;
      setFolders((foldersData || []) as Folder[]);
    } catch (error) {
      console.error('Error fetching deleted items:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDeleted();
  }, [fetchDeleted]);

  const handleRestoreNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_deleted: false })
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
        .update({ is_deleted: false })
        .eq('id', id);

      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== id));
      toast({ title: 'Folder restored' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handlePermanentDeleteNote = async () => {
    if (!deleteNoteId) return;
    
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', deleteNoteId);

      if (error) throw error;
      
      setNotes(prev => prev.filter(n => n.id !== deleteNoteId));
      setDeleteNoteId(null);
      toast({ title: 'Note deleted permanently' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handlePermanentDeleteFolder = async () => {
    if (!deleteFolderId) return;
    
    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', deleteFolderId);

      if (error) throw error;
      
      setFolders(prev => prev.filter(f => f.id !== deleteFolderId));
      setDeleteFolderId(null);
      toast({ title: 'Folder deleted permanently' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEmptyBin = async () => {
    try {
      // Delete all notes
      const { error: notesError } = await supabase
        .from('notes')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_deleted', true);

      if (notesError) throw notesError;

      // Delete all folders
      const { error: foldersError } = await supabase
        .from('folders')
        .delete()
        .eq('user_id', user?.id)
        .eq('is_deleted', true);

      if (foldersError) throw foldersError;
      
      setNotes([]);
      setFolders([]);
      setEmptyBinOpen(false);
      toast({ title: 'Bin emptied', description: 'All items permanently deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const totalItems = notes.length + folders.length;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Bin"
        description="Items will be permanently deleted after 30 days"
        icon={<Trash2 className="w-4 h-4 text-destructive" />}
        actions={
          totalItems > 0 ? (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setEmptyBinOpen(true)}
              className="text-xs sm:text-sm"
            >
              Empty Bin
            </Button>
          ) : undefined
        }
      />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg sm:text-xl font-medium text-foreground mb-2">Bin is empty</h2>
            <p className="text-muted-foreground max-w-sm text-sm sm:text-base">
              Deleted items will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Deleted Folders */}
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
                        <Button
                          variant="destructive"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8"
                          onClick={() => setDeleteFolderId(folder.id)}
                          title="Delete Forever"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deleted Notes */}
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

      {/* Permanent Delete Note Dialog */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Forever
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Folder Dialog */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Folder Forever
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This folder will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Bin Dialog */}
      <AlertDialog open={emptyBinOpen} onOpenChange={setEmptyBinOpen}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Empty Bin
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {totalItems} {totalItems === 1 ? 'item' : 'items'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyBin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Empty Bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
