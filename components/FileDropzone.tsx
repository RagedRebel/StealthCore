"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { UploadCloud, File as FileIcon, Image as ImageIcon, X } from "lucide-react";

interface FileDropzoneProps {
  id: string;
  label: string;
  hint?: string;
  accept?: string;
  file: File | null;
  onFileSelect: (file: File | null) => void;
  isImage?: boolean;
  accentColor?: "indigo" | "coral";
  extraBadge?: React.ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileDropzone({
  id,
  label,
  hint,
  accept,
  file,
  onFileSelect,
  isImage = false,
  accentColor = "indigo",
  extraBadge,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isIndigo = accentColor === "indigo";
  const activeBorderColor = isIndigo ? "rgb(50, 50, 150)" : "rgb(255, 75, 75)";
  const activeBgColor = isIndigo ? "rgba(50, 50, 150, 0.15)" : "rgba(255, 75, 75, 0.15)";
  const iconColor = isIndigo ? "rgb(50, 50, 150)" : "rgb(255, 75, 75)";

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0] ?? null;
    if (droppedFile) {
      onFileSelect(droppedFile);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;
    e.target.value = "";
    onFileSelect(selectedFile);
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <label htmlFor={id} className="font-medium" style={{ color: "rgb(255, 255, 255)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-[11px]" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
            {hint}
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
      />

      {file ? (
        <div
          className="flex items-center justify-between p-3 rounded-xl border transition-all"
          style={{
            backgroundColor: "rgba(50, 50, 50, 0.6)",
            borderColor: "rgb(50, 50, 50)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div
              className="p-2 rounded-lg border shrink-0"
              style={{
                backgroundColor: "rgb(0, 0, 0)",
                borderColor: "rgb(50, 50, 50)",
                color: iconColor,
              }}
            >
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "rgb(255, 255, 255)" }}>
                {file.name}
              </p>
              <div className="flex items-center gap-2 flex-wrap text-xs" style={{ color: "rgba(255, 255, 255, 0.55)" }}>
                <span>{formatBytes(file.size)}</span>
                {extraBadge}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove file"
            className="p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgb(239, 68, 68)";
              e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255, 255, 255, 0.6)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className="flex flex-col items-center justify-center p-5 rounded-xl border border-dashed cursor-pointer transition-all"
          style={{
            borderColor: isDragging ? activeBorderColor : "rgb(50, 50, 50)",
            backgroundColor: isDragging ? activeBgColor : "rgba(50, 50, 50, 0.25)",
          }}
        >
          <div
            className="p-2.5 rounded-full border mb-2"
            style={{
              backgroundColor: "rgb(0, 0, 0)",
              borderColor: "rgb(50, 50, 50)",
              color: iconColor,
            }}
          >
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-center" style={{ color: "rgb(255, 255, 255)" }}>
            Click to upload or drag &amp; drop
          </p>
          <p className="text-xs mt-0.5 text-center" style={{ color: "rgba(255, 255, 255, 0.45)" }}>
            {accept ? `${accept.replace(/\./g, "").toUpperCase()} files` : "Any file format"}
          </p>
        </div>
      )}
    </div>
  );
}
