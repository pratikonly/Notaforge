import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, LogOut, User, FolderPlus,
  FileText, Image, Link, FileIcon, Video, Music, Grid, Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from './PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { FolderCard } from './FolderCard';
import { FolderEditor } from './FolderEditor';
import { FolderSelector } from './FolderSelector';
import { useAuth } from '@/hooks/useAuth';
import { useNotes, Note, NoteType } from '@/hooks/useNotes';
import { useFolders, Folder } from '@/hooks/useFolders';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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

const filterOptions: { type: NoteType | 'all'; label: string; icon: React.ElementType }[] = [
  { type: 'all', label: 'All', icon: Grid },
  { type: 'text', label: 'Text', icon: FileText },
  { type: 'image', label: 'Images', icon: Image },
  { type: 'link', label: 'Links', icon: Link },
  { type: 'pdf', label: 'PDFs', icon: FileIcon },
  { type: 'video', label: 'Videos', icon: Video },
  { type: 'audio', label: 'Audio', icon: Music },
];

export function Dashboard() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<NoteType | 'all'>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  
  // Folder state
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null);
  
  // Folder selector state
  const [isFolderSelectorOpen, setIsFolderSelectorOpen] = useState(false);
  const [noteToMove, setNoteToMove] = useState<string | null>(null);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const { user, signOut } = useAuth();
  const { notes, loading, createNote, updateNote, uploadFile, moveToFolder, refetch } = useNotes();
  const { folders, loading: foldersLoading, createFolder, updateFolder } = useFolders();
  const { toast } = useToast();

  // Fetch ungrouped notes on mount
  useEffect(() => {
    if (user?.id) {
      refetch(undefined); // undefined = ungrouped notes only
    }
  }, [user?.id, refetch]);

  // Calculate note count per folder
  const [folderNoteCounts, setFolderNoteCounts] = useState<Record<string, number>>({});
  const [subfolderCounts, setSubfolderCounts] = useState<Record<string, number>>({});
  
  const fetchFolderCounts = useCallback(async () => {
    if (!user?.id || folders.length === 0) return;
    
    const counts: Record<string, number> = {};
    const subCounts: Record<string, number> = {};
    
    for (const folder of folders) {
      // Note counts
      const { count } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('folder_id', folder.id)
        .eq('is_archived', false)
        .eq('is_deleted', false);
      counts[folder.id] = count || 0;
      
      // Subfolder counts
      const { count: subCount } = await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('parent_id', folder.id)
        .eq('is_archived', false)
        .eq('is_deleted', false);
      subCounts[folder.id] = subCount || 0;
    }
    
    setFolderNoteCounts(counts);
    setSubfolderCounts(subCounts);
  }, [folders, user?.id]);
  
  useEffect(() => {
    fetchFolderCounts();
  }, [fetchFolderCounts]);

  // Handle image from file (for paste/drop)
  const handleImageFile = useCallback(async (file: File) => {
    if (!user?.id) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please use JPG, PNG, GIF, or WEBP images',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Uploading image...', description: 'Please wait' });
    
    const url = await uploadFile(file);
    if (url) {
      await createNote({
        title: file.name.split('.')[0] || 'Pasted Image',
        note_type: 'image',
        file_url: url,
        file_name: file.name,
      });
      toast({ title: 'Image note created!' });
    }
  }, [user?.id, uploadFile, createNote, toast]);

  // Handle paste event
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleImageFile(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleImageFile]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the drop zone entirely
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: 'No images found',
        description: 'Please drop image files (JPG, PNG, GIF, WEBP)',
        variant: 'destructive',
      });
      return;
    }

    for (const file of imageFiles) {
      await handleImageFile(file);
    }
  }, [handleImageFile, toast]);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.content?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterType === 'all' || note.note_type === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleNewNote = () => {
    setEditingNote(null);
    setIsEditorOpen(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setIsEditorOpen(true);
  };

  const handleSaveNote = async (noteData: Partial<Note>) => {
    if (editingNote) {
      await updateNote(editingNote.id, noteData);
    } else {
      await createNote(noteData);
    }
  };

  const handleDeleteNote = async () => {
    if (deleteNoteId) {
      await updateNote(deleteNoteId, { is_deleted: true });
      setDeleteNoteId(null);
    }
  };

  const handleArchiveNote = async (id: string) => {
    await updateNote(id, { is_archived: true });
    toast({
      title: 'Note archived',
      description: 'Note moved to archive',
    });
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    await updateNote(id, { is_pinned: isPinned });
  };

  // Folder handlers
  const handleNewFolder = (parentId?: string | null) => {
    setEditingFolder(null);
    setParentFolderForNew(parentId || null);
    setIsFolderEditorOpen(true);
  };

  const handleRenameFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setParentFolderForNew(null);
    setIsFolderEditorOpen(true);
  };

  const handleSaveFolder = async (name: string) => {
    if (editingFolder) {
      await updateFolder(editingFolder.id, { name });
    } else {
      await createFolder(name, parentFolderForNew);
    }
    setParentFolderForNew(null);
    fetchFolderCounts();
  };

  const handleArchiveFolder = async (id: string) => {
    await updateFolder(id, { is_archived: true });
    toast({ title: 'Folder archived' });
  };

  const handleDeleteFolder = async () => {
    if (deleteFolderId) {
      await updateFolder(deleteFolderId, { is_deleted: true });
      setDeleteFolderId(null);
    }
  };

  // Move to folder handlers
  const handleMoveToFolder = (noteId: string) => {
    setNoteToMove(noteId);
    setIsFolderSelectorOpen(true);
  };

  const handleSelectFolder = async (folderId: string) => {
    if (noteToMove) {
      await moveToFolder(noteToMove, folderId);
      fetchFolderCounts();
      toast({ title: 'Note moved to folder' });
      setNoteToMove(null);
    }
  };

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  return (
    <div 
      ref={dropZoneRef}
      className="min-h-screen relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-primary rounded-2xl bg-card">
            <Upload className="w-12 h-12 text-primary animate-bounce" />
            <p className="text-lg font-medium text-foreground">Drop images here</p>
            <p className="text-sm text-muted-foreground">JPG, PNG, GIF, or WEBP</p>
          </div>
        </div>
      )}
      <PageHeader
        title="Vault"
        description="Your secure notes"
        icon={<FileText className="w-4 h-4 text-primary" />}
        showAccountMenu={false}
        actions={
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search */}
            <div className="hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50 w-32 lg:w-48"
                />
              </div>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground">{username}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Mobile Search */}
        <div className="sm:hidden mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {filterOptions.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-all ${
                  filterType === type
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => handleNewFolder()} className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
              <FolderPlus className="w-4 h-4" />
              <span className="hidden sm:inline">New Folder</span>
            </Button>
            <Button variant="vault" onClick={handleNewNote} className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">New Note</span>
            </Button>
          </div>
        </div>

        {/* Folders Section */}
        {folders.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Folders</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
              {folders.map((folder) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  noteCount={folderNoteCounts[folder.id] || 0}
                  subfolderCount={subfolderCounts[folder.id] || 0}
                  onClick={() => navigate(`/folder/${folder.id}`)}
                  onRename={() => handleRenameFolder(folder)}
                  onArchive={() => handleArchiveFolder(folder.id)}
                  onDelete={() => setDeleteFolderId(folder.id)}
                  onCreateSubfolder={() => handleNewFolder(folder.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Notes Grid */}
        {loading || foldersLoading ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredNotes.length === 0 && folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg sm:text-xl font-medium text-foreground mb-2">
              {searchQuery || filterType !== 'all' ? 'No notes found' : 'Your vault is empty'}
            </h2>
            <p className="text-muted-foreground mb-4 sm:mb-6 max-w-sm text-sm sm:text-base">
              {searchQuery || filterType !== 'all' 
                ? 'Try adjusting your search or filter'
                : 'Start by creating a note, pasting an image, or drag and drop files here'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button variant="vault" onClick={handleNewNote} className="gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Create First Note
                </Button>
                <span className="text-xs text-muted-foreground">
                  or paste (Ctrl+V) / drop images
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {filteredNotes.length > 0 && (
              <>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">
                  {folders.length > 0 ? 'Ungrouped Notes' : 'Notes'}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                  {filteredNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onEdit={handleEditNote}
                      onDelete={(id) => setDeleteNoteId(id)}
                      onTogglePin={handleTogglePin}
                      onArchive={handleArchiveNote}
                      showMoveButton={folders.length > 0}
                      onMoveToFolder={handleMoveToFolder}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Note count */}
        {filteredNotes.length > 0 && (
          <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground">
            {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'} in your vault
          </div>
        )}
      </main>

      {/* Note Editor Modal */}
      <NoteEditor
        note={editingNote}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveNote}
        onUploadFile={uploadFile}
      />

      {/* Folder Editor Modal */}
      <FolderEditor
        isOpen={isFolderEditorOpen}
        onClose={() => setIsFolderEditorOpen(false)}
        onSave={handleSaveFolder}
        initialName={editingFolder?.name || ''}
        mode={editingFolder ? 'rename' : 'create'}
      />

      {/* Folder Selector Modal */}
      <FolderSelector
        isOpen={isFolderSelectorOpen}
        onClose={() => {
          setIsFolderSelectorOpen(false);
          setNoteToMove(null);
        }}
        folders={folders}
        onSelectFolder={handleSelectFolder}
      />

      {/* Delete Note Confirmation Dialog */}
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

      {/* Delete Folder Confirmation Dialog */}
      <AlertDialog open={!!deleteFolderId} onOpenChange={() => setDeleteFolderId(null)}>
        <AlertDialogContent className="bg-card border-border max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this folder? Notes inside will be moved to ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteFolder}
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
