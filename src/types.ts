
export interface ImageFile {
  id: string;
  file: File;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  previewUrl: string;
  processedUrl?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
}

export interface ProcessingResult {
  id: string;
  blob: Blob;
  url: string;
}
