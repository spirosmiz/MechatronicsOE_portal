import { useRef, useState } from 'react';
import { Upload, Trash2, ExternalLink, Film, FileText, Image, Loader2 } from 'lucide-react';
import { useMedia, useUploadMedia, useDeleteMedia } from '@/hooks/useQueries';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { MediaFile } from '@/types';
import { formatDate } from '@/lib/utils';

interface Props {
  entityType: 'machine' | 'customer' | 'inventory';
  entityId: string;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <Image className="w-8 h-8 text-blue-400" />;
  if (mimeType.startsWith('video/')) return <Film className="w-8 h-8 text-purple-400" />;
  return <FileText className="w-8 h-8 text-gray-400" />;
}

export function MediaGallery({ entityType, entityId }: Props) {
  const { data: files = [], isLoading } = useMedia(entityType, entityId);
  const uploadMut = useUploadMedia();
  const deleteMut = useDeleteMedia();
  const { toast } = useToast();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'project_manager' || user?.role === 'technician';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const file = fileList[0];
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: 'File exceeds 100 MB limit', variant: 'destructive' });
      return;
    }
    try {
      await uploadMut.mutateAsync({ entityType, entityId, file });
      toast({ title: `"${file.name}" uploaded to Google Drive` });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed';
      toast({ title: msg, variant: 'destructive' });
    }
  }

  async function handleDelete(f: MediaFile) {
    if (!confirm(`Remove "${f.name}" from Drive?`)) return;
    try {
      await deleteMut.mutateAsync({ id: f.id, entityType, entityId });
      toast({ title: 'File deleted' });
    } catch {
      toast({ title: 'Failed to delete file', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {canEdit && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadMut.isPending ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Uploading to Google Drive…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-8 h-8" />
              <p className="text-sm font-medium">Drop files here or click to upload</p>
              <p className="text-xs">Images, videos, PDFs — max 100 MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* File grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-4">No media files uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {files.map((f) => (
            <div key={f.id} className="group relative rounded-lg border overflow-hidden bg-gray-50 hover:shadow-md transition-shadow">
              {/* Thumbnail or icon */}
              {f.thumbnailUrl ? (
                <img
                  src={f.thumbnailUrl}
                  alt={f.name}
                  className="w-full h-24 object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-24 flex items-center justify-center bg-gray-100">
                  <FileIcon mimeType={f.mimeType} />
                </div>
              )}

              {/* Info */}
              <div className="p-2">
                <p className="text-xs font-medium truncate" title={f.name}>{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(f.uploadedAt)}</p>
                {f.uploader && <p className="text-xs text-muted-foreground">{f.uploader.name}</p>}
              </div>

              {/* Actions overlay */}
              <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                <a
                  href={f.driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-7 w-7 rounded bg-white/90 flex items-center justify-center shadow hover:bg-white"
                  title="Open in Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                </a>
                {canEdit && (
                  <button
                    className="h-7 w-7 rounded bg-white/90 flex items-center justify-center shadow hover:bg-white"
                    title="Delete file"
                    onClick={() => handleDelete(f)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">{files.length} file{files.length !== 1 ? 's' : ''} stored in Google Drive</p>
      )}
    </div>
  );
}

// Convenience dialog wrapper used by MachinesPage and CustomersPage
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GalleryDialogProps extends Props {
  open: boolean;
  onClose: () => void;
  title: string;
}

export function MediaGalleryDialog({ open, onClose, title, entityType, entityId }: GalleryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Media — {title}
          </DialogTitle>
        </DialogHeader>
        <MediaGallery entityType={entityType} entityId={entityId} />
        <div className="pt-2">
          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
