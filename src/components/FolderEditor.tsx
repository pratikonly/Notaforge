import { useState, useEffect } from 'react';
import { Folder as FolderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface FolderEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  initialName?: string;
  mode: 'create' | 'rename';
}

export function FolderEditor({ isOpen, onClose, onSave, initialName = '', mode }: FolderEditorProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border sm:max-w-md max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <FolderIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            {mode === 'create' ? 'New Folder' : 'Rename Folder'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            className="bg-input border-border text-sm sm:text-base"
            autoFocus
          />
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-sm">
              Cancel
            </Button>
            <Button type="submit" variant="vault" disabled={!name.trim()} className="text-sm">
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
