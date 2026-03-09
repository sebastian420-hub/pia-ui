import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DocumentUploader: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type === 'application/pdf' || selectedFile.type === 'text/plain') {
      setFile(selectedFile);
      setStatus('idle');
      setMessage('');
    } else {
      setStatus('error');
      setMessage('INVALID FORMAT: STRICTLY PDF OR TXT');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    setMessage('INJECTING INTO NEURAL QUEUE...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8001/api/v1/documents/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.status === 'success') {
        setStatus('success');
        setMessage('DOCUMENT INGESTED. AWAITING FUSION.');
        setTimeout(() => {
          setFile(null);
          setStatus('idle');
          setIsOpen(false); // Auto-close on success
        }, 3000);
      } else {
        setStatus('error');
        setMessage(result.message || 'UPLOAD FAILED');
      }
    } catch (error) {
      setStatus('error');
      setMessage('NETWORK CONNECTION FAILED');
    }
  };

  return (
    <div className="absolute top-16 right-4 z-40 font-mono">
      {/* Closed State: The Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-10 h-10 bg-black/80 backdrop-blur border border-white/20 text-white/70 hover:text-sentinel-blue hover:border-sentinel-blue rounded transition-colors shadow-lg"
          title="Open Document Ingestor"
        >
          <FileText size={18} />
        </button>
      )}

      {/* Expanded State: The Dropzone */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, transformOrigin: "top right" }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-80 bg-black/80 backdrop-blur-lg border border-white/20 rounded shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-white/5 p-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold text-white tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-sentinel-blue" />
                DEEP DOC EXPLOITER
              </span>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${status === 'uploading' ? 'bg-yellow-500 animate-pulse' : status === 'success' ? 'bg-green-500' : 'bg-sentinel-blue'}`}></div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4">
              <div 
                className={`border-2 border-dashed rounded flex flex-col items-center justify-center p-6 transition-colors cursor-pointer
                  ${isDragging ? 'border-sentinel-blue bg-sentinel-blue/10' : 'border-white/20 hover:border-white/40'}
                  ${status === 'success' ? 'border-green-500/50 bg-green-500/5' : ''}
                  ${status === 'error' ? 'border-red-500/50 bg-red-500/5' : ''}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf,.txt"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                />
                
                <AnimatePresence mode="wait">
                  {status === 'idle' && !file && (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                      <Upload size={24} className="text-white/40 mx-auto mb-2" />
                      <p className="text-[10px] text-white/50 tracking-wider">DROP TARGET PDF/TXT HERE</p>
                    </motion.div>
                  )}

                  {file && status !== 'success' && (
                    <motion.div key="file" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center w-full">
                      <FileText size={24} className="text-sentinel-blue mx-auto mb-2" />
                      <p className="text-[10px] text-white truncate px-2">{file.name}</p>
                      <p className="text-[9px] text-white/40 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </motion.div>
                  )}

                  {status === 'success' && (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                      <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                      <p className="text-[10px] text-green-500 font-bold tracking-wider">SECURE TRANSFER COMPLETE</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Action / Status Bar */}
              <div className="mt-4">
                {status === 'error' && (
                  <div className="flex items-center gap-2 text-[10px] text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20 mb-2">
                    <AlertTriangle size={12} />
                    {message}
                  </div>
                )}

                {status === 'uploading' && (
                  <div className="flex items-center justify-center gap-2 text-[10px] text-yellow-500 tracking-widest font-bold">
                    <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    {message}
                  </div>
                )}

                {file && status === 'idle' && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                    className="w-full bg-sentinel-blue/20 hover:bg-sentinel-blue/40 border border-sentinel-blue text-sentinel-blue text-[10px] font-bold tracking-widest py-2 rounded transition-colors"
                  >
                    EXECUTE INJECTION
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentUploader;
