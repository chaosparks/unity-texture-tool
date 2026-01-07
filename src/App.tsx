
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Trash2, Download, RefreshCw, Info, CheckCircle2, AlertCircle, FileImage, Image as ImageIcon } from 'lucide-react';
import { type ImageFile } from './types';
import { calculateTargetDimension, getImageDimensions, resizeImage } from './utils/imageUtils';
import { GoogleGenAI } from '@google/genai';

// External declaration for JSZip since we loaded it via CDN
declare const JSZip: any;

const App: React.FC = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizationTip, setOptimizationTip] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch a tip from Gemini about Unity texture optimization
  useEffect(() => {
    const fetchTip = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: "Provide a very short, one-sentence tip for optimizing textures in Unity for better mobile performance (mention Crunch compression or Power of Two).",
        });
        setOptimizationTip(response.text);
      } catch (err) {
        console.error("Failed to fetch tip:", err);
      }
    };
    fetchTip();
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const newImages: ImageFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const { width, height } = await getImageDimensions(file);
        const targetWidth = calculateTargetDimension(width);
        const targetHeight = calculateTargetDimension(height);

        newImages.push({
          id: Math.random().toString(36).substring(7),
          file,
          originalWidth: width,
          originalHeight: height,
          targetWidth,
          targetHeight,
          previewUrl: URL.createObjectURL(file),
          status: 'pending'
        });
      } catch (err) {
        console.error("Error loading file:", file.name, err);
      }
    }

    setImages(prev => [...prev, ...newImages]);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const processAll = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);

    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
      const img = updatedImages[i];
      if (img.status === 'done') continue;

      try {
        updatedImages[i] = { ...img, status: 'processing' };
        setImages([...updatedImages]);

        const processedBlob = await resizeImage(img.file, img.targetWidth, img.targetHeight);
        const processedUrl = URL.createObjectURL(processedBlob);

        updatedImages[i] = {
          ...updatedImages[i],
          processedUrl,
          status: 'done'
        };
        setImages([...updatedImages]);
      } catch (err) {
        updatedImages[i] = { ...img, status: 'error' };
        setImages([...updatedImages]);
      }
    }

    setIsProcessing(false);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // Revoke URLs to prevent memory leaks
      const removed = prev.find(img => img.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        if (removed.processedUrl) URL.revokeObjectURL(removed.processedUrl);
      }
      return filtered;
    });
  };

  const clearAll = () => {
    images.forEach(img => {
      URL.revokeObjectURL(img.previewUrl);
      if (img.processedUrl) URL.revokeObjectURL(img.processedUrl);
    });
    setImages([]);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    const doneImages = images.filter(img => img.status === 'done' && img.processedUrl);

    if (doneImages.length === 0) return;

    for (const img of doneImages) {
      const response = await fetch(img.processedUrl!);
      const blob = await response.blob();
      // Use original file name
      const fileName = img.file.name;
      zip.file(fileName, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = "unity_textures_resized.zip";
    link.click();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-6xl mx-auto">
      {/* Header */}
      <header className="w-full text-center mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-900/20">
          <ImageIcon size={32} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Unity Texture Resizer</h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Automatically snap image dimensions to the nearest multiple of 4 to support 
          <span className="text-blue-400 font-semibold"> Unity Crunch Compression</span>.
        </p>
        
        {optimizationTip && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700 text-sm text-slate-300">
            <Info size={16} className="text-blue-400" />
            <span>{optimizationTip}</span>
          </div>
        )}
      </header>

      {/* Upload Zone */}
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className="w-full bg-slate-800/40 border-2 border-dashed border-slate-700 rounded-3xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-800/60 transition-all group"
      >
        <input 
          type="file" 
          multiple 
          accept="image/png,image/jpeg" 
          className="hidden" 
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload size={28} className="text-slate-400 group-hover:text-blue-400" />
          </div>
          <p className="text-xl font-medium text-slate-200">Drop your textures here</p>
          <p className="text-sm text-slate-500 mt-2">Supports PNG, JPG (Multiple files ok)</p>
        </div>
      </div>

      {/* Controls */}
      {images.length > 0 && (
        <div className="w-full mt-8 flex flex-wrap gap-4 items-center justify-between bg-slate-800/50 p-4 rounded-2xl border border-slate-700 sticky top-4 z-10 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-400">{images.length} images selected</span>
            <button 
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={processAll}
              disabled={isProcessing || images.every(img => img.status === 'done')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
                isProcessing || images.every(img => img.status === 'done')
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
              }`}
            >
              {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              {isProcessing ? 'Processing...' : 'Process All'}
            </button>
            <button
              onClick={downloadAll}
              disabled={!images.some(img => img.status === 'done')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
                !images.some(img => img.status === 'done')
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              <Download size={18} />
              Download ZIP
            </button>
          </div>
        </div>
      )}

      {/* Image Grid */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {images.map((img) => (
          <div 
            key={img.id}
            className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden flex flex-col group hover:border-slate-500 transition-colors"
          >
            <div className="relative aspect-square bg-slate-900 flex items-center justify-center p-4">
              <img 
                src={img.status === 'done' ? img.processedUrl : img.previewUrl} 
                alt={img.file.name}
                className="max-w-full max-h-full object-contain rounded shadow-lg"
              />
              <button 
                onClick={() => removeImage(img.id)}
                className="absolute top-3 right-3 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
              
              {/* Status Badge */}
              <div className="absolute bottom-3 left-3">
                {img.status === 'done' ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-500/30">
                    <CheckCircle2 size={10} /> Ready
                  </span>
                ) : img.status === 'processing' ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-500/30">
                    <RefreshCw size={10} className="animate-spin" /> Processing
                  </span>
                ) : img.status === 'error' ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded border border-red-500/30">
                    <AlertCircle size={10} /> Error
                  </span>
                ) : null}
              </div>
            </div>

            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-medium text-slate-200 truncate pr-4" title={img.file.name}>
                  {img.file.name}
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">{(img.file.size / 1024).toFixed(1)} KB</span>
              </div>
              
              <div className="mt-auto flex items-center justify-between text-xs py-3 border-t border-slate-700/50">
                <div className="flex flex-col">
                  <span className="text-slate-500 mb-1">Original</span>
                  <span className="text-slate-300 font-mono">{img.originalWidth} x {img.originalHeight}</span>
                </div>
                <div className="flex flex-col items-center">
                   <div className="w-4 h-px bg-slate-700 mb-4" />
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-blue-400 mb-1">Corrected</span>
                  <span className={`font-mono font-bold ${img.originalWidth === img.targetWidth && img.originalHeight === img.targetHeight ? 'text-slate-300' : 'text-blue-400'}`}>
                    {img.targetWidth} x {img.targetHeight}
                  </span>
                </div>
              </div>

              {img.status === 'done' && (
                <a 
                  href={img.processedUrl} 
                  download={img.file.name}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download size={14} />
                  Download
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {images.length === 0 && (
        <div className="mt-12 text-center text-slate-500">
          <p>No images uploaded yet.</p>
          <div className="mt-4 flex flex-col items-start gap-3 max-w-sm mx-auto text-left bg-slate-800/30 p-4 rounded-2xl text-xs border border-slate-700/50">
             <div className="flex gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
               <p>Round nearest multiple of 4 (e.g. 34px → 32px, 35px → 36px).</p>
             </div>
             <div className="flex gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
               <p>Maintains aspect ratio if both dimensions change accordingly.</p>
             </div>
             <div className="flex gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></div>
               <p>Preserves dimensions of 1 or 2 (essential for thin masks).</p>
             </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-slate-800 w-full text-center text-slate-600 text-sm">
        <p>&copy; {new Date().getFullYear()} Texture Utility for Unity Developers</p>
      </footer>
    </div>
  );
};

export default App;
