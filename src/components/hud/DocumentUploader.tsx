import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface Props { onClose: () => void }

/** Upload a PDF/TXT for ingestion. Rendered by the parent in a fixed slot. */
const DocumentUploader: React.FC<Props> = ({ onClose }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File) => {
    if (f.type === 'application/pdf' || f.type === 'text/plain' || /\.(pdf|txt)$/i.test(f.name)) {
      setFile(f); setStatus('idle'); setMessage('');
    } else { setStatus('error'); setMessage('Only PDF or TXT files'); }
  };

  const upload = async () => {
    if (!file) return;
    setStatus('uploading'); setMessage('Uploading…');
    const form = new FormData(); form.append('file', file);
    const r = await apiFetch('/api/v1/documents/upload', { method: 'POST', body: form });
    if (r.status === 'success') {
      setStatus('success'); setMessage('Queued. The document agent will process it within a minute.');
      setTimeout(onClose, 2500);
    } else { setStatus('error'); setMessage(r.message || 'Upload failed'); }
  };

  return (
    <div className="w-80 bg-bg-1 border border-line rounded shadow-xl font-mono text-[12px]">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between">
        <span className="tracking-[0.2em] text-text-2 flex items-center gap-2"><FileText size={13} /> UPLOAD DOCUMENT</span>
        <button onClick={onClose} className="text-text-3 hover:text-text-1"><X size={14} /></button>
      </div>
      <div className="p-3">
        <div
          className={`border border-dashed rounded flex flex-col items-center justify-center p-5 cursor-pointer transition-colors ${
            isDragging ? 'border-accent bg-accent/10' : status === 'success' ? 'border-ok/50' : status === 'error' ? 'border-err/50' : 'border-line hover:border-text-3'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.txt" onChange={(e) => e.target.files && pick(e.target.files[0])} />
          {status === 'success' ? (
            <><CheckCircle size={22} className="text-ok mb-1" /><p className="text-ok">Queued</p></>
          ) : file ? (
            <><FileText size={22} className="text-accent mb-1" /><p className="text-text-1 truncate max-w-full">{file.name}</p><p className="text-text-3">{(file.size / 1024 / 1024).toFixed(2)} MB</p></>
          ) : (
            <><Upload size={22} className="text-text-3 mb-1" /><p className="text-text-3">Drop a PDF or TXT here, or click</p></>
          )}
        </div>
        {message && status !== 'success' && (
          <div className={`mt-2 flex items-center gap-2 ${status === 'error' ? 'text-err' : 'text-text-2'}`}>
            {status === 'error' && <AlertTriangle size={12} />} {message}
          </div>
        )}
        {status === 'success' && <div className="mt-2 text-text-2">{message}</div>}
        {file && status === 'idle' && (
          <button onClick={upload} className="mt-3 w-full border border-accent text-text-1 hover:bg-accent/20 py-1.5 rounded tracking-widest">UPLOAD</button>
        )}
      </div>
    </div>
  );
};

export default DocumentUploader;
