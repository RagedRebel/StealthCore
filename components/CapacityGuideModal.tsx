"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, TableProperties } from "lucide-react";
import {
  calculateMaxCapacity,
  estimateMaxSecretFileSize,
  formatBytes,
} from "@/lib/capacity";

interface CapacityGuideModalProps {
  onClose: () => void;
}

interface GuideRow {
  label: string;
  width: number;
  height: number;
  example: string;
}

// Common carrier sizes. Capacity values are derived at render time via
// lib/capacity so they stay in sync with the embed logic (3 bits/px,
// 90% safety margin, header + crypto overhead).
const GUIDE_ROWS: GuideRow[] = [
  { label: "Small", width: 512, height: 512, example: "Short e-book, large text file" },
  { label: "Medium", width: 800, height: 600, example: "Word doc, small PDF" },
  { label: "Large", width: 1024, height: 1024, example: "Compressed photo, short audio clip" },
  { label: "HD", width: 1280, height: 720, example: "E-book with images" },
  { label: "Full HD", width: 1920, height: 1080, example: "~1-min MP3, image-rich PDF" },
  { label: "QHD", width: 2560, height: 1440, example: "Small exposure-bracketed set, audio note" },
  { label: "4K Ultra", width: 3840, height: 2160, example: "Full MP3 song, large PDF" },
];
export default function CapacityGuideModal({ onClose }: CapacityGuideModalProps) {
  const [shown, setShown] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = reducedMotion ? 0 : 220;

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    // Flip back to the hidden state so the fade/scale-out plays,
    // then unmount after the transition finishes.
    setShown(false);
    closeTimer.current = setTimeout(onClose, duration);
  }, [onClose, duration]);

  useEffect(() => {
    // Trigger the enter transition on the next frame so initial
    // styles are painted first.
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

  // Portal to document.body so the popup overlays the whole viewport.
  // (The form card uses backdrop-blur, which would otherwise trap a
  // `position: fixed` child inside the card.)
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
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
        aria-label="PNG capacity guide"
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: "rgb(20, 20, 22)",
          borderColor: "rgb(50, 50, 50)",
          opacity: shown ? 1 : 0,
          transform: shown ? "scale(1) translateY(0)" : "scale(0.96) translateY(10px)",
          transition: `opacity ${duration}ms ease-out, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0"
          style={{
            borderColor: "rgba(50, 50, 50, 0.8)",
            backgroundColor: "rgb(20, 20, 22)",
          }}
        >
          <h3
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "rgb(255, 255, 255)" }}
          >
            <TableProperties
              className="w-4 h-4"
              style={{ color: "rgb(35, 250, 56)" }}
            />
            <span>Max Capacity by Image Size</span>
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close capacity guide"
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p
            className="text-[11px] leading-relaxed mb-3"
            style={{ color: "rgba(255, 255, 255, 0.65)" }}
          >
            PNG is lossless, so capacity depends on resolution — not a quality
            setting. Each pixel hides 3 bits (R, G, B LSB) with a 90% safety
            margin applied.
          </p>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgb(50, 50, 50)" }}>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ backgroundColor: "rgba(50, 50, 150, 0.25)" }}>
                  {["Size", "Resolution", "Max secret file", "Good for"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="text-left font-semibold px-3 py-2"
                      style={{ color: "rgb(255, 255, 255)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GUIDE_ROWS.map((row, idx) => {
                  const maxPayload = calculateMaxCapacity(row.width, row.height);
                  const maxSecret = estimateMaxSecretFileSize(row.width, row.height);
                  const megapixels = ((row.width * row.height) / 1_000_000).toFixed(2);
                  return (
                    <tr
                      key={row.label}
                      style={{
                        backgroundColor: idx % 2 === 0 ? "rgba(50, 50, 50, 0.25)" : "transparent",
                        borderTop: "1px solid rgba(50, 50, 50, 0.6)",
                      }}
                    >
                      <td className="px-3 py-2 font-medium" style={{ color: "rgb(35, 250, 56)" }}>
                        {row.label}
                      </td>
                      <td className="px-3 py-2 font-mono" style={{ color: "rgba(255, 255, 255, 0.85)" }}>
                        {row.width} × {row.height}
                        <span className="block text-[10px]" style={{ color: "rgba(255, 255, 255, 0.45)" }}>
                          {megapixels} MP
                        </span>
                      </td>
                      <td
                        className="px-3 py-2 font-mono font-semibold"
                        title={`Max hidden payload incl. headers: ${formatBytes(maxPayload)}`}
                      >
                        <span style={{ color: "rgb(255, 255, 255)" }}>
                          {formatBytes(maxSecret)}
                        </span>
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{ color: "rgba(255, 255, 255, 0.6)" }}
                      >
                        {row.example}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] leading-relaxed mt-3" style={{ color: "rgba(255, 255, 255, 0.45)" }}>
            “Max secret file” already accounts for the 4-byte length header
            and ~80 B encryption overhead.
          </p>

          <button
            type="button"
            onClick={handleClose}
            className="w-full mt-4 py-2 px-4 text-xs font-medium rounded-xl border transition-all cursor-pointer"
            style={{
              backgroundColor: "rgb(50, 50, 150)",
              borderColor: "rgb(50, 50, 150)",
              color: "rgb(255, 255, 255)",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
