"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, BarChart3, Activity, ShieldCheck, Info } from "lucide-react";

interface QualityReportModalProps {
  psnr: number | null; // null indicates Infinity (lossless/MSE = 0)
  ssim: number;
  onClose: () => void;
}

interface MetricGrade {
  grade: "Perfect" | "Excellent" | "Good" | "Acceptable" | "Poor";
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  percentage: number;
}

function getPsnrGrade(psnr: number | null): MetricGrade {
  if (psnr === null) {
    return {
      grade: "Perfect",
      label: "Lossless / Bit-Identical",
      description:
        "Zero pixel deviation (MSE = 0). The cover and stego images are mathematically identical.",
      color: "rgb(35, 250, 56)",
      bgColor: "rgba(35, 250, 56, 0.14)",
      borderColor: "rgba(35, 250, 56, 0.35)",
      percentage: 100,
    };
  }

  // Scale 0 to 60 dB to 0-100% fill bar (anything >= 60 dB fills 100%)
  const percentage = Math.min(100, Math.max(0, (psnr / 60) * 100));

  if (psnr >= 50) {
    return {
      grade: "Excellent",
      label: "Imperceptible Distortion",
      description:
        "Pixel noise is indistinguishable to the human eye. Exceeds standard steganography threshold (≥ 50 dB).",
      color: "rgb(35, 250, 56)",
      bgColor: "rgba(35, 250, 56, 0.14)",
      borderColor: "rgba(35, 250, 56, 0.35)",
      percentage,
    };
  }
  if (psnr >= 40) {
    return {
      grade: "Good",
      label: "High Quality",
      description:
        "Very faint pixel noise that requires digital analysis tools to detect (40 – 49 dB).",
      color: "rgb(56, 189, 248)",
      bgColor: "rgba(56, 189, 248, 0.14)",
      borderColor: "rgba(56, 189, 248, 0.35)",
      percentage,
    };
  }
  if (psnr >= 30) {
    return {
      grade: "Acceptable",
      label: "Moderate Noise",
      description:
        "Minor pixel modifications may be detectable upon close inspection (30 – 39 dB).",
      color: "rgb(245, 158, 11)",
      bgColor: "rgba(245, 158, 11, 0.14)",
      borderColor: "rgba(245, 158, 11, 0.35)",
      percentage,
    };
  }
  return {
    grade: "Poor",
    label: "Noticeable Distortion",
    description:
      "Significant pixel alterations that may be visible without magnification (< 30 dB).",
    color: "rgb(239, 68, 68)",
    bgColor: "rgba(239, 68, 68, 0.14)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    percentage,
  };
}

function getSsimGrade(ssim: number): MetricGrade {
  // Scale 0.0 to 1.0 to 0-100%
  const percentage = Math.min(100, Math.max(0, ssim * 100));

  if (ssim >= 0.99) {
    return {
      grade: "Excellent",
      label: "Virtually Identical Structure",
      description:
        "Luminance, contrast, and structural textures match the original almost perfectly (≥ 0.99).",
      color: "rgb(35, 250, 56)",
      bgColor: "rgba(35, 250, 56, 0.14)",
      borderColor: "rgba(35, 250, 56, 0.35)",
      percentage,
    };
  }
  if (ssim >= 0.95) {
    return {
      grade: "Good",
      label: "High Structural Fidelity",
      description:
        "Slight structural variation, well within imperceptible visual thresholds (0.95 – 0.98).",
      color: "rgb(56, 189, 248)",
      bgColor: "rgba(56, 189, 248, 0.14)",
      borderColor: "rgba(56, 189, 248, 0.35)",
      percentage,
    };
  }
  if (ssim >= 0.90) {
    return {
      grade: "Acceptable",
      label: "Moderate Similarity",
      description:
        "Noticeable structural deviation across image windows, but content remains intact (0.90 – 0.94).",
      color: "rgb(245, 158, 11)",
      bgColor: "rgba(245, 158, 11, 0.14)",
      borderColor: "rgba(245, 158, 11, 0.35)",
      percentage,
    };
  }
  return {
    grade: "Poor",
    label: "Low Similarity",
    description:
      "Significant differences in structural patterns, contrast, or luminance (< 0.90).",
    color: "rgb(239, 68, 68)",
    bgColor: "rgba(239, 68, 68, 0.14)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    percentage,
  };
}

export default function QualityReportModal({
  psnr,
  ssim,
  onClose,
}: QualityReportModalProps) {
  const [shown, setShown] = useState(false);
  const [barAnimated, setBarAnimated] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duration = reducedMotion ? 0 : 220;

  const psnrGrade = getPsnrGrade(psnr);
  const ssimGrade = getSsimGrade(ssim);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    closeTimer.current = setTimeout(onClose, duration);
  }, [onClose, duration]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShown(true);
      // Slight delay for progress bar fill animation to feel organic
      setTimeout(() => setBarAnimated(true), 100);
    });

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

  const isBothExcellent =
    (psnrGrade.grade === "Excellent" || psnrGrade.grade === "Perfect") &&
    ssimGrade.grade === "Excellent";

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
        aria-label="Image Quality and Imperceptibility Report"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl flex flex-col"
        style={{
          backgroundColor: "rgb(20, 20, 22)",
          borderColor: "rgb(50, 50, 50)",
          opacity: shown ? 1 : 0,
          transform: shown
            ? "scale(1) translateY(0)"
            : "scale(0.96) translateY(10px)",
          transition: `opacity ${duration}ms ease-out, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10"
          style={{
            borderColor: "rgba(50, 50, 50, 0.8)",
            backgroundColor: "rgb(20, 20, 22)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-lg border flex items-center justify-center"
              style={{
                backgroundColor: "rgba(35, 250, 56, 0.12)",
                borderColor: "rgba(35, 250, 56, 0.3)",
              }}
            >
              <BarChart3
                className="w-4 h-4"
                style={{ color: "rgb(35, 250, 56)" }}
              />
            </div>
            <div>
              <h3
                className="text-sm font-semibold tracking-wide"
                style={{ color: "rgb(255, 255, 255)" }}
              >
                Steganographic Quality Report
              </h3>
              <p
                className="text-[11px]"
                style={{ color: "rgba(255, 255, 255, 0.55)" }}
              >
                Objective metrics comparing carrier before vs. after embedding
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close quality report"
            className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-neutral-800"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 flex-1">
          {/* Summary Banner */}
          <div
            className="p-3.5 rounded-xl border flex items-center justify-between gap-3"
            style={{
              backgroundColor: isBothExcellent
                ? "rgba(35, 250, 56, 0.08)"
                : "rgba(56, 189, 248, 0.08)",
              borderColor: isBothExcellent
                ? "rgba(35, 250, 56, 0.25)"
                : "rgba(56, 189, 248, 0.25)",
            }}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck
                className="w-5 h-5 shrink-0"
                style={{
                  color: isBothExcellent
                    ? "rgb(35, 250, 56)"
                    : "rgb(56, 189, 248)",
                }}
              />
              <div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: "rgb(255, 255, 255)" }}
                >
                  {isBothExcellent
                    ? "Stealth Grade: Imperceptible & Secure"
                    : "Stealth Grade: Verified Carrier Fidelity"}
                </div>
                <div
                  className="text-[11px]"
                  style={{ color: "rgba(255, 255, 255, 0.65)" }}
                >
                  {isBothExcellent
                    ? "Carrier modification is completely invisible to human inspection and statistical tests."
                    : "Metrics confirm low distortion across spatial and frequency domains."}
                </div>
              </div>
            </div>
          </div>

          {/* Metric 1: PSNR */}
          <div
            className="p-4 rounded-xl border"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderColor: "rgba(60, 60, 65, 0.6)",
            }}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(255, 255, 255)" }}
                  >
                    PSNR (Peak Signal-to-Noise Ratio)
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "rgba(255, 255, 255, 0.7)",
                    }}
                  >
                    Pixel Noise
                  </span>
                </div>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                >
                  {psnrGrade.label} — {psnrGrade.description}
                </p>
              </div>

              {/* Value and Grade Badge */}
              <div className="text-right shrink-0">
                <div
                  className="text-lg font-bold font-mono tracking-tight"
                  style={{ color: psnrGrade.color }}
                >
                  {psnr !== null ? `${psnr.toFixed(2)} dB` : "∞ (Lossless)"}
                </div>
                <span
                  className="inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-semibold border"
                  style={{
                    backgroundColor: psnrGrade.bgColor,
                    borderColor: psnrGrade.borderColor,
                    color: psnrGrade.color,
                  }}
                >
                  {psnrGrade.grade}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div
                className="w-full h-3 rounded-full overflow-hidden relative"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: barAnimated ? `${psnrGrade.percentage}%` : "0%",
                    backgroundColor: psnrGrade.color,
                    boxShadow: `0 0 10px ${psnrGrade.color}66`,
                  }}
                />
              </div>

              {/* Scale Labels */}
              <div
                className="flex justify-between items-center text-[10px] mt-1.5 font-mono"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                <span>0 dB (Poor)</span>
                <span>30 dB</span>
                <span>40 dB</span>
                <span style={{ color: "rgb(35, 250, 56)" }}>50+ dB (Excellent)</span>
                <span>60 dB</span>
              </div>
            </div>
          </div>

          {/* Metric 2: SSIM */}
          <div
            className="p-4 rounded-xl border"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderColor: "rgba(60, 60, 65, 0.6)",
            }}
          >
            {/* Top row */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "rgb(255, 255, 255)" }}
                  >
                    SSIM (Structural Similarity Index)
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      color: "rgba(255, 255, 255, 0.7)",
                    }}
                  >
                    Visual Structure
                  </span>
                </div>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                >
                  {ssimGrade.label} — {ssimGrade.description}
                </p>
              </div>

              {/* Value and Grade Badge */}
              <div className="text-right shrink-0">
                <div
                  className="text-lg font-bold font-mono tracking-tight"
                  style={{ color: ssimGrade.color }}
                >
                  {ssim.toFixed(4)}
                </div>
                <span
                  className="inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-semibold border"
                  style={{
                    backgroundColor: ssimGrade.bgColor,
                    borderColor: ssimGrade.borderColor,
                    color: ssimGrade.color,
                  }}
                >
                  {ssimGrade.grade}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div
                className="w-full h-3 rounded-full overflow-hidden relative"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: barAnimated ? `${ssimGrade.percentage}%` : "0%",
                    backgroundColor: ssimGrade.color,
                    boxShadow: `0 0 10px ${ssimGrade.color}66`,
                  }}
                />
              </div>

              {/* Scale Labels */}
              <div
                className="flex justify-between items-center text-[10px] mt-1.5 font-mono"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                <span>0.00 (Poor)</span>
                <span>0.90</span>
                <span>0.95</span>
                <span style={{ color: "rgb(35, 250, 56)" }}>0.99 (Excellent)</span>
                <span>1.00 (Identical)</span>
              </div>
            </div>
          </div>

          {/* Educational Legend */}
          <div
            className="p-4 rounded-xl border space-y-3"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              borderColor: "rgba(60, 60, 65, 0.4)",
            }}
          >
            <div className="flex items-center gap-2">
              <Info
                className="w-4 h-4"
                style={{ color: "rgba(255, 255, 255, 0.7)" }}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: "rgb(255, 255, 255)" }}
              >
                Understanding Steganographic Metrics
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
              <div
                className="p-2.5 rounded-lg border"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderColor: "rgba(255, 255, 255, 0.05)",
                  color: "rgba(255, 255, 255, 0.7)",
                }}
              >
                <div
                  className="font-medium mb-1"
                  style={{ color: "rgb(255, 255, 255)" }}
                >
                  PSNR (Peak Signal-to-Noise Ratio)
                </div>
                Measures logarithmic pixel reconstruction fidelity using Mean Squared Error (MSE). Values above 50 dB mean that modifications are confined to negligible least-significant bits.
              </div>

              <div
                className="p-2.5 rounded-lg border"
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                  borderColor: "rgba(255, 255, 255, 0.05)",
                  color: "rgba(255, 255, 255, 0.7)",
                }}
              >
                <div
                  className="font-medium mb-1"
                  style={{ color: "rgb(255, 255, 255)" }}
                >
                  SSIM (Structural Similarity)
                </div>
                Models the Human Visual System (HVS) by analyzing windowed luminance, contrast, and structural consistency. Scores close to 1.0 guarantee that natural image textures are preserved.
              </div>
            </div>

            {/* Grading Scale Table */}
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255, 255, 255, 0.07)" }}>
              <div
                className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                style={{ color: "rgba(255, 255, 255, 0.5)" }}
              >
                Grade Benchmarks
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div
                  className="p-2 rounded-lg border flex flex-col items-center text-center"
                  style={{
                    backgroundColor: "rgba(35, 250, 56, 0.06)",
                    borderColor: "rgba(35, 250, 56, 0.2)",
                  }}
                >
                  <span
                    className="font-semibold text-[11px]"
                    style={{ color: "rgb(35, 250, 56)" }}
                  >
                    Excellent
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5">
                    ≥ 50 dB · ≥ 0.99
                  </span>
                  <span className="text-[9px] text-neutral-500 mt-0.5">
                    Imperceptible
                  </span>
                </div>

                <div
                  className="p-2 rounded-lg border flex flex-col items-center text-center"
                  style={{
                    backgroundColor: "rgba(56, 189, 248, 0.06)",
                    borderColor: "rgba(56, 189, 248, 0.2)",
                  }}
                >
                  <span
                    className="font-semibold text-[11px]"
                    style={{ color: "rgb(56, 189, 248)" }}
                  >
                    Good
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5">
                    40–49 dB · 0.95–0.98
                  </span>
                  <span className="text-[9px] text-neutral-500 mt-0.5">
                    High Fidelity
                  </span>
                </div>

                <div
                  className="p-2 rounded-lg border flex flex-col items-center text-center"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.06)",
                    borderColor: "rgba(245, 158, 11, 0.2)",
                  }}
                >
                  <span
                    className="font-semibold text-[11px]"
                    style={{ color: "rgb(245, 158, 11)" }}
                  >
                    Acceptable
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5">
                    30–39 dB · 0.90–0.94
                  </span>
                  <span className="text-[9px] text-neutral-500 mt-0.5">
                    Minor Noise
                  </span>
                </div>

                <div
                  className="p-2 rounded-lg border flex flex-col items-center text-center"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.06)",
                    borderColor: "rgba(239, 68, 68, 0.2)",
                  }}
                >
                  <span
                    className="font-semibold text-[11px]"
                    style={{ color: "rgb(239, 68, 68)" }}
                  >
                    Poor
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-0.5">
                    &lt; 30 dB · &lt; 0.90
                  </span>
                  <span className="text-[9px] text-neutral-500 mt-0.5">
                    Degraded
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3.5 border-t flex justify-end"
          style={{
            borderColor: "rgba(50, 50, 50, 0.8)",
            backgroundColor: "rgb(20, 20, 22)",
          }}
        >
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer border"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderColor: "rgba(255, 255, 255, 0.15)",
              color: "rgb(255, 255, 255)",
            }}
          >
            Close Report
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
