import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X, CheckCircle } from 'lucide-react';
import { Card, CardContent } from '../shared/Elements';
import { pdfjs } from 'react-pdf';

// Ensure worker is configured
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DropzoneUploaderProps {
  file: File | null;
  pageCount: number;
  onUploadSuccess: (file: File, pageCount: number) => void;
  onClear: () => void;
}

export function DropzoneUploader({ file, pageCount, onUploadSuccess, onClear }: DropzoneUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const extractPageCount = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages;
    } catch (err) {
      console.error('Failed to parse PDF:', err);
      throw new Error('Failed to parse PDF document.');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    const file = acceptedFiles[0];

    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('File exceeds the 100MB size limit.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB warning limit
      setPendingFile(file);
      return;
    }

    await processFile(file);
  }, [onUploadSuccess]);

  const processFile = async (processFile: File) => {
    setIsProcessing(true);
    setPendingFile(null);

    try {
      const pages = await extractPageCount(processFile);
      onUploadSuccess(processFile, pages);
    } catch (err) {
      setError('Could not extract page count from PDF.');
    } finally {
      setIsProcessing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleClear = () => {
    setError(null);
    onClear();
  };

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // SUCCESS STATE (Compact Card)
  if (file) {
    return (
      <Card className="border-brand-dark/20 bg-brand-dark/5 shadow-sm">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-lg shadow-sm border border-slate-200 flex items-center justify-center">
              <FileIcon className="w-6 h-6 text-brand-dark" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 text-lg">{file.name}</h4>
              <div className="flex items-center text-sm text-slate-500 mt-1 space-x-3">
                <span className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1 text-emerald-500" />
                  {pageCount} Pages Parsed
                </span>
                <span>•</span>
                <span>{formatSize(file.size)}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={handleClear}
            className="text-slate-400 hover:text-red-500 p-2 transition-colors rounded-full hover:bg-white"
            title="Remove File"
          >
            <X className="w-5 h-5" />
          </button>
        </CardContent>
      </Card>
    );
  }

  // PENDING STATE (Size Warning Modal)
  if (pendingFile) {
    return (
      <div className="w-full">
        <Card className="border-amber-300 bg-amber-50 shadow-md">
          <CardContent className="p-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center mb-4 shadow-sm">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-amber-900 mb-2">Large File Detected</h3>
            <p className="text-amber-800 mb-2 font-medium">
              You are trying to upload a file that is <strong>{formatSize(pendingFile.size)}</strong>.
            </p>
            <p className="text-amber-700 text-sm mb-6 max-w-md mx-auto">
              PDFs over 10MB can significantly impact your readers' experience. Client devices will have to download this large file before the flipbook can initialize, leading to slow loading times on weak network connections.
            </p>
            
            <div className="flex space-x-4">
              <button 
                onClick={() => setPendingFile(null)} 
                className="px-6 py-2 border border-amber-400 text-amber-800 font-semibold rounded-lg hover:bg-amber-100 transition-colors"
              >
                Cancel Upload
              </button>
              <button 
                onClick={() => processFile(pendingFile)} 
                className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-lg shadow hover:bg-amber-700 transition-colors"
              >
                Proceed Anyway
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // UPLOAD STATE (Large Dropzone)
  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-brand-dark bg-brand-dark/5 shadow-inner' : 'border-slate-300 hover:border-brand-dark/50 hover:bg-slate-50'}
          ${error ? 'border-red-400 bg-red-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-dark mb-4"></div>
            <p className="text-slate-600 font-medium">Analyzing PDF structure...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-brand-dark/10 text-brand-dark rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <p className="text-lg font-semibold text-slate-700 mb-1">
              Drag & drop compressed PDF here
            </p>
            <p className="text-sm text-slate-500 mb-4">
              or click to browse from your computer (Max 100MB)
            </p>
            {error && (
              <p className="text-sm font-medium text-red-500 mt-2 bg-red-100 px-3 py-1 rounded-full">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
