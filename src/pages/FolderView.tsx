import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Folder as FolderIcon, ArrowLeft, Plus, Home, ChevronRight, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteCard } from '@/components/NoteCard';
import { NoteEditor } from '@/components/NoteEditor';
import { FolderCard } from '@/components/FolderCard';
import { FolderEditor } from '@/components/FolderEditor';
import { FolderSelector } from '@/components/FolderSelector';
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

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export default function FolderView() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [folder, setFolder] = useState<Folder | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  
  // Subfolder state
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  
  // Move to folder state
  const [isFolderSelectorOpen, setIsFolderSelectorOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<string | null>(null);
  
  const [subfolderNoteCounts, setSubfolderNoteCounts] = useState<Record<string, number>>({});

  const buildBreadcrumbs = useCallback(async (currentFolder: Folder) => {
    const crumbs: BreadcrumbItem[] = [{ id: null, name: 'Home' }];
    let parent = currentFolder;
    const trail: BreadcrumbItem[] = [];
    
    while (parent.parent_id) {
      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('id', parent.parent_id)
        .maybeSingle();
      
      if (data) {
        trail.unshift({ id: data.id, name: data.name });
        parent = data as Folder;
      } else {
        break;
      }
    }
    
    crumbs.push(...trail);
    crumbs.push({ id: currentFolder.id, name: currentFolder.name });
    setBreadcrumbs(crumbs);
  }, []);

  const fetchFolderAndNotes = useCallback(async () => {
    if (!user?.id || !folderId) return;
    
    try {
      setLoading(true);
      
      // Fetch folder
      const { data: folderData, error: folderError } = await supabase
        .from('folders')
        .select('*')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (folderError) throw folderError;
      if (!folderData) {
        navigate('/');
        return;
      }
      setFolder(folderData as Folder);
      buildBreadcrumbs(folderData as Folder);
      
      // Fetch notes in folder
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (notesError) throw notesError;
      setNotes((notesData || []) as Note[]);
      
      // Fetch subfolders
      const { data: subfoldersData, error: subfoldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .eq('parent_id', folderId)
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false });

      if (subfoldersError) throw subfoldersError;
      setSubfolders((subfoldersData || []) as Folder[]);
      
      // Fetch all folders for move selector
      const { data: allFoldersData } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .eq('is_deleted', false)
        .neq('id', folderId);
      setAllFolders((allFoldersData || []) as Folder[]);
      
      // Fetch note counts for subfolders
      const counts: Record<string, number> = {};
      for (const sf of (subfoldersData || [])) {
        const { count } = await supabase
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('folder_id', sf.id)
          .eq('is_archived', false)
          .eq('is_deleted', false);
        counts[sf.id] = count || 0;
      }
      setSubfolderNoteCounts(counts);
    } catch (error) {
      console.error('Error fetching folder:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [user?.id, folderId, navigate, buildBreadcrumbs]);

  useEffect(() => {
    fetchFolderAndNotes();
  }, [fetchFolderAndNotes]);

  const handleNewNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSaveNote = async (noteData: Partial<Note>) => {
    if (!user?.id) return;
    
    try {
      if (editingNote) {
        const { data, error } = await supabase
          .from('notes')
          .update(noteData)
          .eq('id', editingNote.id)
          .select()
          .single();
        
        if (error) throw error;
        setNotes(prev => prev.map(n => n.id === editingNote.id ? data as Note : n));
      } else {
        const { data, error } = await supabase
          .from('notes')
          .insert({
            user_id: user.id,
            folder_id: folderId,
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
        toast({ title: 'Note created', description: 'Your note has been saved.' });
      }
    } catch (error) {
      console.error('Error saving note:', error);
      toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' });
    }
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;
    
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_deleted: true })
        .eq('id', deleteNoteId);

      if (error) throw error;
      setNotes(prev => prev.filter(n => n.id !== deleteNoteId));
      setDeleteNoteId(null);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleArchiveNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_archived: true })
        .eq('id', id);

      if (error) throw error;
      setNotes(prev => prev.filter(n => n.id !== id));
      toast({ title: 'Note archived' });
    } catch (error) {
      console.error('Error archiving note:', error);
    }
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_pinned: isPinned })
        .eq('id', id);

      if (error) throw error;
      setNotes(prev => prev.map(n => n.id === id ? { ...n, is_pinned: isPinned } : n));
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Move to folder handlers
  const handleMoveToFolder = (noteId: string) => {
    setNoteToMove(noteId);
    setIsFolderSelectorOpen(true);
  };

  const handleSelectFolder = async (targetFolderId: string) => {
    if (noteToMove) {
      try {
        await supabase.from('notes').update({ folder_id: targetFolderId }).eq('id', noteToMove);
        setNotes(prev => prev.filter(n => n.id !== noteToMove));
        toast({ title: 'Note moved to folder' });
        setNoteToMove(null);
      } catch (error) {
        console.error('Error moving note:', error);
      }
    }
  };

  const handleRemoveFromFolder = async (noteId: string) => {
    try {
      await supabase.from('notes').update({ folder_id: null }).eq('id', noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast({ title: 'Note moved to ungrouped' });
    } catch (error) {
      console.error('Error removing note from folder:', error);
    }
  };

  // Subfolder handlers
  const handleNewSubfolder = () => {
    setEditingFolder(null);
    setIsFolderEditorOpen(true);
  };

  const handleRenameSubfolder = (subfolder: Folder) => {
    setEditingFolder(subfolder);
    setIsFolderEditorOpen(true);
  };

  const handleSaveSubfolder = async (name: string) => {
    try {
      if (editingFolder) {
        await supabase.from('folders').update({ name }).eq('id', editingFolder.id);
        setSubfolders(prev => prev.map(f => f.id === editingFolder.id ? { ...f, name } : f));
      } else {
        const { data, error } = await supabase
          .from('folders')
          .insert({ user_id: user?.id, name, parent_id: folderId })
          .select()
          .single();
        if (error) throw error;
        setSubfolders(prev => [data as Folder, ...prev]);
        toast({ title: 'Subfolder created' });
      }
    } catch (error) {
      console.error('Error saving subfolder:', error);
    }
  };

  const handleArchiveSubfolder = async (id: string) => {
    try {
      await supabase.from('folders').update({ is_archived: true }).eq('id', id);
      setSubfolders(prev => prev.filter(f => f.id !== id));
      toast({ title: 'Subfolder archived' });
    } catch (error) {
      console.error('Error archiving subfolder:', error);
    }
  };

  const handleDeleteSubfolder = async () => {
    if (!deleteFolderId) return;
    try {
      await supabase.from('folders').update({ is_deleted: true }).eq('id', deleteFolderId);
      setSubfolders(prev => prev.filter(f => f.id !== deleteFolderId));
      setDeleteFolderId(null);
    } catch (error) {
      console.error('Error deleting subfolder:', error);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('note-files')
        .upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('note-files')
        .getPublicUrl(fileName);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader
        title={folder?.name || 'Folder'}
        description={`${notes.length} notes`}
        icon={<FolderIcon className="w-4 h-4 text-primary" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNewSubfolder} className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Subfolder</span>
            </Button>
            <Button variant="vault" size="sm" onClick={handleNewNote} className="gap-1 sm:gap-2 text-xs sm:text-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Note</span>
            </Button>
          </div>
        }
      />
      
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Breadcrumbs */}
        {breadcrumbs.length > 1 && (
          <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 overflow-x-auto">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.id || 'home'} className="flex items-center gap-1 flex-shrink-0">
                {index > 0 && <ChevronRight className="w-3 h-3" />}
                <button
                  onClick={() => crumb.id ? navigate(`/folder/${crumb.id}`) : navigate('/')}
                  className={`hover:text-foreground transition-colors ${
                    index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''
                  }`}
                >
                  {crumb.id === null ? <Home className="w-4 h-4" /> : crumb.name}
                </button>
              </div>
            ))}
          </nav>
        )}

        {/* Subfolders */}
        {subfolders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Subfolders</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {subfolders.map((subfolder) => (
                <FolderCard
                  key={subfolder.id}
                  folder={subfolder}
                  noteCount={subfolderNoteCounts[subfolder.id] || 0}
                  onClick={() => navigate(`/folder/${subfolder.id}`)}
                  onRename={() => handleRenameSubfolder(subfolder)}
                  onArchive={() => handleArchiveSubfolder(subfolder.id)}
                  onDelete={() => setDeleteFolderId(subfolder.id)}
                />
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 && subfolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <FolderIcon className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg sm:text-xl font-medium text-foreground mb-2">Folder is empty</h2>
            <p className="text-muted-foreground max-w-sm text-sm sm:text-base mb-4 sm:mb-6">
              Create a note or use the move button on notes from the home page
            </p>
            <Button variant="vault" onClick={handleNewNote} className="gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Create Note
            </Button>
          </div>
        ) : notes.length > 0 && (
          <>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Notes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onEdit={handleEditNote}
                  onDelete={(id) => setDeleteNoteId(id)}
                  onTogglePin={handleTogglePin}
                  onArchive={handleArchiveNote}
                  showMoveButton={allFolders.length > 0}
                  onMoveToFolder={handleMoveToFolder}
                  showRemoveFromFolder={true}
                  onRemoveFromFolder={handleRemoveFromFolder}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <NoteEditor
        note={editingNote}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveNote}
        onUploadFile={uploadFile}
      />

      <FolderEditor
        isOpen={isFolderEditorOpen}
        onClose={() => setIsFolderEditorOpen(false)}
        onSave={handleSaveSubfolder}
        initialName={editingFolder?.name || ''}
        mode={editingFolder ? 'rename' : 'create'}
      />

      <FolderSelector
        isOpen={isFolderSelectorOpen}
        onClose={() => {
          setIsFolderSelectorOpen(false);
          setNoteToMove(null);
        }}
        folders={allFolders}
        onSelectFolder={handleSelectFolder}
      />

      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Subfolder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subfolder?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSubfolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
