'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Attachment } from '@/lib/types';
import { apiFetch, apiUploadWithProgress } from '@/lib/api';
import { Avatar } from './Avatar';
import { useAuth } from '@/lib/auth-context';
import {
  Upload,
  FileText,
  FileCode,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  Eye,
  Paperclip,
} from 'lucide-react';

interface FilesTabProps {
  taskId: number;
  currentUserRole?: string;
  onAttachmentCountChange?: (delta: number) => void;
}

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.txt', '.log', '.csv', '.json'];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const FilesTab: React.FC<FilesTabProps> = ({
  taskId,
  currentUserRole,
  onAttachmentCountChange,
}) => {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drag over state & upload progress
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Lightbox Preview state
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Attachment[]>(`/tasks/${taskId}/attachments`);
      setAttachments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load attachments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchAttachments();
    }
  }, [taskId]);

  // Handle Ctrl+V Clipboard Paste Anywhere in the Tab
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const filesToUpload: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            // If pasted image lacks name, give it a timestamp name
            const renamedFile = new File(
              [file],
              file.name === 'image.png' ? `pasted-screenshot-${Date.now()}.png` : file.name,
              { type: file.type }
            );
            filesToUpload.push(renamedFile);
          }
        }
      }

      if (filesToUpload.length > 0) {
        processAndUploadFiles(filesToUpload);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [taskId]);

  const validateFiles = (files: File[]): string | null => {
    if (files.length > 5) {
      return 'Maximum 5 files can be uploaded per request.';
    }

    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) {
        return `File "${f.name}" exceeds the 5 MB size limit.`;
      }
      const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `File "${f.name}" has an unsupported format. Allowed: PNG, JPG, WEBP, GIF, PDF, TXT, LOG, CSV, JSON.`;
      }
    }
    return null;
  };

  const processAndUploadFiles = async (files: File[]) => {
    const validationError = validateFiles(files);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    files.forEach((f) => formData.append('file', f));

    try {
      const uploaded = await apiUploadWithProgress<Attachment[]>(
        `/tasks/${taskId}/attachments`,
        formData,
        (percent) => setUploadProgress(percent)
      );

      setAttachments((prev) => [...uploaded, ...prev]);
      if (onAttachmentCountChange) onAttachmentCountChange(uploaded.length);
    } catch (err: any) {
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileList = Array.from(e.target.files);
      processAndUploadFiles(fileList);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileList = Array.from(e.dataTransfer.files);
      processAndUploadFiles(fileList);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm('Are you sure you want to delete this file attachment?')) return;

    try {
      await apiFetch(`/attachments/${attachmentId}`, { method: 'DELETE' });
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      if (onAttachmentCountChange) onAttachmentCountChange(-1);
    } catch (err: any) {
      alert(err.message || 'Failed to delete attachment');
    }
  };

  const getDownloadUrl = (attachmentId: number) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sprintify_token') : '';
    return `${API_BASE_URL}/attachments/${attachmentId}/download?token=${encodeURIComponent(token || '')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (mimeType.startsWith('image/')) return null;
    if (mimeType === 'application/pdf' || ext === 'pdf') return <FileText className="w-5 h-5 text-[#B4413C]" />;
    if (ext === 'csv') return <FileSpreadsheet className="w-5 h-5 text-[#2E7D4F]" />;
    if (ext === 'json') return <FileCode className="w-5 h-5 text-[#A8680F]" />;
    return <FileIcon className="w-5 h-5 text-app-text-muted" />;
  };

  return (
    <div className="flex flex-col h-full min-h-[380px] space-y-4">
      {error && (
        <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-3 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-0.5 hover:bg-black/5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-primary bg-primary-soft/50 shadow-soft-lg'
            : 'border-app-border hover:border-primary/60 bg-surface-soft/40 hover:bg-surface-soft/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.log,.csv,.json"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          </div>

          <div className="space-y-0.5">
            <p className="text-xs font-bold text-app-text">
              Drop files here, click to browse, or paste (Ctrl+V)
            </p>
            <p className="text-[11px] text-app-text-muted">
              Images, PDF, TXT, LOG, CSV, JSON (Max 5 MB each, up to 5 files)
            </p>
          </div>
        </div>

        {/* Upload Progress Bar */}
        {uploading && uploadProgress !== null && (
          <div className="mt-3 max-w-xs mx-auto space-y-1">
            <div className="w-full bg-app-border rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[10px] font-semibold text-primary">Uploading... {uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Attachments List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-app-text-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs font-semibold">Loading attachments...</p>
          </div>
        ) : attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-app-text-muted space-y-2 text-center">
            <Paperclip className="w-8 h-8 text-app-text-muted/40" />
            <p className="text-xs font-semibold text-app-text">No files yet</p>
            <p className="text-xs">Drop screenshots or logs here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attachments.map((a) => {
              const isImage = a.mime_type.startsWith('image/');
              const downloadUrl = getDownloadUrl(a.id);
              const isUploader = user && a.uploaded_by === user.id;
              const isOwner = currentUserRole === 'OWNER';
              const canDelete = isUploader || isOwner;

              return (
                <div
                  key={a.id}
                  className="bg-surface rounded-xl border border-app-border p-3 shadow-soft hover:shadow-soft-lg transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail or File Icon */}
                    {isImage ? (
                      <div
                        onClick={() => setPreviewAttachment(a)}
                        className="w-14 h-14 rounded-lg bg-surface-soft border border-app-border/60 overflow-hidden relative group/img cursor-pointer shrink-0"
                      >
                        <img
                          src={downloadUrl}
                          alt={a.original_name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-surface-soft border border-app-border/60 flex items-center justify-center shrink-0">
                        {getFileIcon(a.mime_type, a.original_name)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p
                        onClick={() => isImage && setPreviewAttachment(a)}
                        className={`text-xs font-bold text-app-text truncate ${
                          isImage ? 'cursor-pointer hover:text-primary' : ''
                        }`}
                        title={a.original_name}
                      >
                        {a.original_name}
                      </p>
                      <p className="text-[10px] text-app-text-muted">
                        {formatFileSize(a.size_bytes)}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-app-text-muted pt-0.5">
                        <Avatar name={a.uploader?.name || 'User'} size="xs" />
                        <span className="truncate">{a.uploader?.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-app-border/40 text-xs">
                    <a
                      href={downloadUrl}
                      download={a.original_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>

                    {canDelete && (
                      <button
                        onClick={() => handleDeleteAttachment(a.id)}
                        className="p-1 text-app-text-muted hover:text-feedback-error rounded transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Image Preview Modal */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-xl border border-app-border shadow-soft-lg max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-app-border bg-surface-soft/40">
              <span className="text-xs font-bold text-app-text truncate">
                {previewAttachment.original_name}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={getDownloadUrl(previewAttachment.id)}
                  download={previewAttachment.original_name}
                  className="p-1.5 text-app-text-muted hover:text-primary rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 text-app-text-muted hover:text-app-text rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-center overflow-auto max-h-[80vh] bg-surface-soft/20">
              <img
                src={getDownloadUrl(previewAttachment.id)}
                alt={previewAttachment.original_name}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-soft"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
