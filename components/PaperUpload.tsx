"use client";

import { useState, useRef, useCallback, DragEvent } from "react";

interface PaperUploadProps {
  onSubmit: (file: File) => void;
  isLoading: boolean;
}

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export default function PaperUpload({ onSubmit, isLoading }: PaperUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSet = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("File exceeds 20MB limit. Try a shorter paper.");
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSet(file);
    },
    [validateAndSet]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSet(file);
    },
    [validateAndSet]
  );

  const handleSubmit = useCallback(() => {
    if (selectedFile && !isLoading) onSubmit(selectedFile);
  }, [selectedFile, isLoading, onSubmit]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
      {/* Drop zone */}
      <div
        className={`flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed cursor-pointer transition-colors ${
          isDragOver
            ? "border-[#555] bg-[#161616]"
            : "border-[#333] bg-[#111] hover:border-[#444] hover:bg-[#131313]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleFileInput}
          disabled={isLoading}
        />

        {selectedFile ? (
          <div className="text-center space-y-2 px-4">
            {/* Document icon */}
            <div className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#888]">
                <rect x="3" y="2" width="11" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M14 2l3 3v13H6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <line x1="6" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="6" y1="10" x2="11" y2="10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                <line x1="6" y1="13" x2="9" y2="13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-xs font-medium text-[#ddd] truncate max-w-[180px]">{selectedFile.name}</p>
            <p className="text-[12px] font-mono text-[#666]">{formatSize(selectedFile.size)}</p>
            <p className="text-[12px] text-[#555] mt-1">click to change</p>
          </div>
        ) : (
          <div className="text-center space-y-3 px-4">
            {/* Upload icon */}
            <div className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-[#666]">
                <path d="M9 12V4M9 4L6 7M9 4l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 13v1.5A1.5 1.5 0 004.5 16h9a1.5 1.5 0 001.5-1.5V13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-[#aaa]">Drop a PDF here</p>
              <p className="text-[12px] text-[#666] mt-0.5">or click to browse</p>
            </div>
            <p className="text-[11px] font-mono text-[#444] tracking-wide">PDF · max 20MB</p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-[12px] font-mono text-[#E05252] px-1">{error}</p>
      )}

      {/* Analyze button */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || isLoading}
        className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-[#ddd] active:scale-[0.98]"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            mapping paper structure
          </span>
        ) : (
          "Analyze"
        )}
      </button>
    </div>
  );
}
