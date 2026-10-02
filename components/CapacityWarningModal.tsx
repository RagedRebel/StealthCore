"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  X,
  UploadCloud,
  Image as ImageIcon,
  FileText,
  HardDrive,
  Info,
} from "lucide-react";
import { formatBytes } from "@/lib/capacity";

interface CapacityWarningModalProps {
  fileName: string;
  fileSize: number;
  maxBytes: number;
  coverDimensions?: { width: number; height: number } | null;
  onClose: () => void;
  onTryDifferentFile: () => void;
  onChangeCover?: () => void;
}

export default function CapacityWarningModal({
  fileName,
  fileSize,
  maxBytes,
  coverDimensions,
  onClose,
  onTryDifferentFile,
  onChangeCover,
}: CapacityWarningModalProps) {
  const [shown, setShown] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = reducedMotion ? 0 : 220;

  const overflowBytes = Math.max(0, fileSize - maxBytes);
  const percentage = maxBytes > 0 ? (fileSize / maxBytes) * 100 : 999;

  // Approximate minimum resolution needed: each pixel holds 2.7 safe bits (0.3375 bytes)
  const minPixelsNeeded = Math.ceil(fileSize / 0.3375);
  const minMegapixels = (minPixelsNeeded / 1_000_000).toFixed(1);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    closeTimer.current = setTimeout(onClose, duration);
  }, [onClose, duration]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        opacity: shown ? 1 : 0,
        transition: `opacity ${duration}ms ease-out`,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Capacity warning"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl flex flex-col"
        style={{
          backgroundColor: "rgb(20, 20, 22)",
          borderColor: "rgba(239, 68, 68, 0.4)",
          opacity: shown ? 1 : 0,
          transform: shown
            ? "scale(1) translateY(0)"
            : "scale(0.96) translateY(10px)",
          transition: `opacity ${duration}ms ease-out, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10"
          style={{
            borderColor: "rgba(50, 50, 50, 0.8)",
            backgroundColor: "rgb(20, 20, 22)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-lg border flex items-center justify-center"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                borderColor: "rgba(239, 68, 68, 0.35)",
              }}
            >
              <AlertTriangle
                className="w-4 h-4"
                style={{ color: "rgb(239, 68, 68)" }}
              />
            </div>
            <div>
              <h3
                className="text-sm font-semibold tracking-wide"
                style={{ color: "rgb(255, 255, 255)" }}
              >
                File Size Exceeds Capacity
              </h3>
              <p
                className="text-[11px]"
                style={{ color: "rgba(255, 255, 255, 0.55)" }}
              >
                Secret file cannot fit into this carrier image
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close capacity warning"
            className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-neutral-800"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-5 py-4 space-y-4 flex-1">
          {/* File Card */}
          <div
            className="p-3 rounded-xl border flex items-center gap-3"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.03)",
              borderColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <div
              className="p-2 rounded-lg border shrink-0"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                borderColor: "rgba(239, 68, 68, 0.25)",
                color: "rgb(239, 68, 68)",
              }}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-xs font-semibold truncate"
                style={{ color: "rgb(255, 255, 255)" }}
              >
                {fileName}
              </div>
              <div
                className="text-[11px] font-mono mt-0.5"
                style={{ color: "rgb(239, 68, 68)" }}
              >
                Selected size: {formatBytes(fileSize)}
              </div>
            </div>
          </div>

          {/* Size Comparison Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div
              className="p-3 rounded-xl border"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.06)",
                borderColor: "rgba(239, 68, 68, 0.25)",
              }}
            >
              <div
                className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: "rgba(239, 68, 68, 0.9)" }}
              >
                Secret File Size
              </div>
              <div
                className="text-base font-bold font-mono mt-1"
                style={{ color: "rgb(239, 68, 68)" }}
              >
                {formatBytes(fileSize)}
              </div>
              <div
                className="text-[10px] mt-0.5"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                {percentage.toFixed(0)}% of max capacity
              </div>
            </div>

            <div
              className="p-3 rounded-xl border"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderColor: "rgba(255, 255, 255, 0.08)",
              }}
            >
              <div
                className="text-[10px] uppercase font-semibold tracking-wider"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                Carrier Capacity Limit
              </div>
              <div
                className="text-base font-bold font-mono mt-1"
                style={{ color: "rgb(35, 250, 56)" }}
              >
                {formatBytes(maxBytes)}
              </div>
              <div
                className="text-[10px] mt-0.5"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                {coverDimensions
                  ? `${coverDimensions.width} × ${coverDimensions.height} px`
                  : "Current carrier"}
              </div>
            </div>
          </div>

          {/* Overflow Alert Banner */}
          <div
            className="p-3 rounded-xl border flex items-center justify-between text-xs"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderColor: "rgba(239, 68, 68, 0.3)",
              color: "rgb(255, 255, 255)",
            }}
          >
            <span>Over capacity by:</span>
            <span
              className="font-mono font-bold px-2 py-0.5 rounded text-xs"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.25)",
                color: "rgb(255, 120, 120)",
              }}
            >
              +{formatBytes(overflowBytes)}
            </span>
          </div>

          {/* Explanation & Recommendation */}
          <div
            className="p-3.5 rounded-xl border space-y-2 text-xs leading-relaxed"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderColor: "rgba(255, 255, 255, 0.06)",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-neutral-400" />
              <div>
                StealthCore protects data integrity using 3 bits per pixel (LSB) with encryption and authentication headers.
                Attempting to embed this file would cause data truncation and corruption.
              </div>
            </div>

            {minPixelsNeeded > 0 && (
              <div
                className="pt-2 border-t text-[11px]"
                style={{
                  borderColor: "rgba(255, 255, 255, 0.06)",
                  color: "rgba(255, 255, 255, 0.6)",
                }}
              >
                <span className="font-semibold text-white">Suggested solution:</span> Choose a secret file smaller than{" "}
                <span className="text-white font-mono">{formatBytes(maxBytes)}</span>, or use a larger cover image of at least{" "}
                <span className="text-white font-mono">~{minMegapixels} Megapixels</span> (e.g., 2560 × 1440 or 4K).
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          className="px-5 py-3.5 border-t flex flex-col sm:flex-row items-center justify-end gap-2"
          style={{
            borderColor: "rgba(50, 50, 50, 0.8)",
            backgroundColor: "rgb(20, 20, 22)",
          }}
        >
          {onChangeCover && (
            <button
              type="button"
              onClick={() => {
                handleClose();
                setTimeout(onChangeCover, duration + 50);
              }}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer border flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderColor: "rgba(255, 255, 255, 0.15)",
                color: "rgba(255, 255, 255, 0.8)",
              }}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Use Larger Cover</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              handleClose();
              setTimeout(onTryDifferentFile, duration + 50);
            }}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer border flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95"
            style={{
              backgroundColor: "rgb(239, 68, 68)",
              borderColor: "rgb(239, 68, 68)",
              color: "rgb(255, 255, 255)",
              boxShadow: "0 2px 10px rgba(239, 68, 68, 0.35)",
            }}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Try with a Different File</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
