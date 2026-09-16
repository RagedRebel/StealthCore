"use client";

import { useState, useRef, type FormEvent } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  Lock,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  HardDrive,
  Info,
} from "lucide-react";
import FileDropzone from "./FileDropzone";
import {
  getPngDimensions,
  estimateMaxSecretFileSize,
  formatBytes,
} from "@/lib/capacity";

export default function EmbedForm() {
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverDimensions, setCoverDimensions] = useState<{ width: number; height: number } | null>(null);
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("stego.png");
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  function handleGeneratePassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=";
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const newPassword = Array.from(array, (b) => chars[b % chars.length]).join("");
    setPassword(newPassword);
    setShowPassword(true);
    setError(null);
  }

  function handleCopyPassword() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCoverChange(file: File | null) {
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);
    setCoverDimensions(null);

    if (file && !file.name.toLowerCase().endsWith(".png") && file.type !== "image/png") {
      setError("Cover image must be a PNG file. Lossy formats like JPEG will corrupt hidden data.");
      setCoverImage(null);
      return;
    }
    setCoverImage(file);

    if (file) {
      const dims = await getPngDimensions(file);
      setCoverDimensions(dims);
    }
  }

  function handleSecretChange(file: File | null) {
    setSecretFile(file);
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);
  }

  const maxSecretBytes = coverDimensions
    ? estimateMaxSecretFileSize(coverDimensions.width, coverDimensions.height)
    : 0;
  const isOverCapacity = Boolean(secretFile && maxSecretBytes > 0 && secretFile.size > maxSecretBytes);
  const usagePercent = secretFile && maxSecretBytes > 0
    ? (secretFile.size / maxSecretBytes) * 100
    : 0;
  const remainingBytes = Math.max(0, maxSecretBytes - (secretFile?.size ?? 0));
  const overflowBytes = Math.max(0, (secretFile?.size ?? 0) - maxSecretBytes);
  const megapixels = coverDimensions
    ? ((coverDimensions.width * coverDimensions.height) / 1_000_000).toFixed(2)
    : "0";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);

    if (!coverImage || !secretFile || !password) {
      setError("All fields are required: cover image, secret file, and encryption password.");
      return;
    }

    if (isOverCapacity) {
      setError(
        `Secret file is too large for this cover image. Maximum capacity is ${formatBytes(maxSecretBytes)}, but file is ${formatBytes(secretFile.size)}.`
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("coverImage", coverImage);
      formData.append("secretFile", secretFile);
      formData.append("password", password);

      const response = await fetch("/api/embed", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "An error occurred during embedding.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `stego_${coverImage.name}`;

      setDownloadUrl(url);
      setDownloadName(filename);
      setSuccessInfo(
        `Secret file "${secretFile.name}" (${formatBytes(secretFile.size)}) successfully encrypted and embedded into "${coverImage.name}".`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const isFormValid = Boolean(coverImage && secretFile && password && !isOverCapacity);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cover Image Input */}
      <div className="space-y-2">
        <FileDropzone
          id="embed-cover"
          label="Cover Image"
          hint="PNG only"
          accept=".png,image/png"
          file={coverImage}
          onFileSelect={handleCoverChange}
          isImage={true}
          accentColor="indigo"
          extraBadge={
            coverDimensions ? (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                style={{
                  backgroundColor: "rgba(35, 250, 56, 0.15)",
                  borderColor: "rgba(35, 250, 56, 0.4)",
                  color: "rgb(35, 250, 56)",
                }}
              >
                Max: {formatBytes(maxSecretBytes)}
              </span>
            ) : null
          }
        />

        {/* Cover Image Capacity & Limits Card */}
        {coverImage && coverDimensions && (
          <div
            className="p-3.5 rounded-xl border transition-all text-xs space-y-2.5"
            style={{
              backgroundColor: isOverCapacity
                ? "rgba(239, 68, 68, 0.08)"
                : "rgba(50, 50, 150, 0.12)",
              borderColor: isOverCapacity
                ? "rgba(239, 68, 68, 0.4)"
                : "rgba(50, 50, 150, 0.35)",
            }}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="p-1.5 rounded-lg border"
                  style={{
                    backgroundColor: isOverCapacity
                      ? "rgba(239, 68, 68, 0.15)"
                      : "rgba(35, 250, 56, 0.15)",
                    borderColor: isOverCapacity
                      ? "rgba(239, 68, 68, 0.3)"
                      : "rgba(35, 250, 56, 0.4)",
                    color: isOverCapacity ? "rgb(239, 68, 68)" : "rgb(35, 250, 56)",
                  }}
                >
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] block" style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                    Max Secret File Size
                  </span>
                  <span
                    className="text-sm font-bold font-mono"
                    style={{
                      color: isOverCapacity ? "rgb(239, 68, 68)" : "rgb(35, 250, 56)",
                    }}
                  >
                    {formatBytes(maxSecretBytes)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className="px-2 py-1 rounded-md text-[11px] font-mono border"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    color: "rgba(255, 255, 255, 0.75)",
                  }}
                >
                  {coverDimensions.width} × {coverDimensions.height} px ({megapixels} MP)
                </span>
              </div>
            </div>

            {/* Detailed Info / Progress */}
            {!secretFile ? (
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
                Upload any confidential file up to{" "}
                <strong className="text-white font-mono">{formatBytes(maxSecretBytes)}</strong> to conceal within this image. Carrier utilizes 3 bits per pixel (R, G, B LSB) with a 90% integrity margin.
              </p>
            ) : (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span
                    style={{
                      color: isOverCapacity ? "rgb(239, 68, 68)" : "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    {isOverCapacity ? (
                      <span className="font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Secret file exceeds maximum capacity by {formatBytes(overflowBytes)}!
                      </span>
                    ) : (
                      <span>
                        Carrier usage:{" "}
                        <strong className="text-white font-mono">
                          {formatBytes(secretFile.size)}
                        </strong>{" "}
                        / <strong className="text-white font-mono">{formatBytes(maxSecretBytes)}</strong>
                      </span>
                    )}
                  </span>
                  <span
                    className="font-mono font-semibold text-xs"
                    style={{
                      color: isOverCapacity
                        ? "rgb(239, 68, 68)"
                        : usagePercent > 85
                        ? "rgb(255, 180, 50)"
                        : "rgb(35, 250, 56)",
                    }}
                  >
                    {usagePercent.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div
                  className="h-2 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
                >
                  <div
                    className="h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.min(100, usagePercent)}%`,
                      backgroundColor: isOverCapacity
                        ? "rgb(239, 68, 68)"
                        : usagePercent > 85
                        ? "rgb(255, 180, 50)"
                        : "rgb(35, 250, 56)",
                      boxShadow: isOverCapacity
                        ? "0 0 8px rgba(239, 68, 68, 0.6)"
                        : "0 0 8px rgba(35, 250, 56, 0.4)",
                    }}
                  />
                </div>

                <div
                  className="flex justify-between text-[10px]"
                  style={{ color: "rgba(255, 255, 255, 0.5)" }}
                >
                  <span>
                    {isOverCapacity
                      ? "Choose a smaller secret file or a higher-resolution cover image."
                      : `${formatBytes(remainingBytes)} free capacity remaining`}
                  </span>
                  <span>LSB safe limit</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Secret File Input */}
      <FileDropzone
        id="embed-secret"
        label="Secret File to Hide"
        hint="Any file format"
        file={secretFile}
        onFileSelect={handleSecretChange}
        isImage={false}
        accentColor="indigo"
      />

      {/* Password Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="embed-password"
            className="block text-xs font-medium"
            style={{ color: "rgb(255, 255, 255)" }}
          >
            Encryption Password
          </label>
          <button
            type="button"
            onClick={handleGeneratePassword}
            className="text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{ color: "rgb(35, 250, 56)" }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate 16-char Password</span>
          </button>
        </div>

        <div className="relative flex items-center">
          <div
            className="absolute left-3.5 pointer-events-none"
            style={{ color: "rgba(255, 255, 255, 0.4)" }}
          >
            <Lock className="w-4 h-4" />
          </div>

          <input
            id="embed-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter or generate a strong password"
            className="w-full pl-10 pr-28 py-2.5 rounded-xl text-sm font-mono transition-all outline-none"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.45)",
              borderColor: "rgb(50, 50, 50)",
              borderWidth: "1px",
              borderStyle: "solid",
              color: "rgb(255, 255, 255)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgb(50, 50, 150)";
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(50, 50, 150, 0.35)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgb(50, 50, 50)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          <div className="absolute right-2.5 flex items-center gap-1">
            {password && (
              <button
                type="button"
                onClick={handleCopyPassword}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
                title="Copy password"
                aria-label="Copy password"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" style={{ color: "rgb(35, 250, 56)" }} />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1.5 rounded-lg transition-colors cursor-pointer"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          className="flex items-start gap-2.5 p-3 rounded-xl border text-sm"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderColor: "rgba(239, 68, 68, 0.35)",
            color: "rgb(239, 68, 68)",
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">{error}</div>
        </div>
      )}

      {/* Success Alert */}
      {successInfo && (
        <div
          className="flex items-start gap-2.5 p-3 rounded-xl border text-sm"
          style={{
            backgroundColor: "rgba(35, 250, 56, 0.12)",
            borderColor: "rgba(35, 250, 56, 0.35)",
            color: "rgb(255, 255, 255)",
          }}
        >
          <CheckCircle2
            className="w-4 h-4 shrink-0 mt-0.5"
            style={{ color: "rgb(35, 250, 56)" }}
          />
          <div className="text-xs leading-relaxed">{successInfo}</div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="w-full py-2.5 px-4 font-medium rounded-xl transition-all cursor-pointer text-sm flex items-center justify-center gap-2 border"
        style={{
          backgroundColor: isFormValid && !loading ? "rgb(50, 50, 150)" : "rgba(50, 50, 50, 0.5)",
          borderColor: isFormValid && !loading ? "rgb(50, 50, 150)" : "rgb(50, 50, 50)",
          color: isFormValid && !loading ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.4)",
          cursor: isFormValid && !loading ? "pointer" : "not-allowed",
          boxShadow: isFormValid && !loading ? "0 4px 14px rgba(50, 50, 150, 0.4)" : "none",
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Encrypting &amp; Embedding...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            <span>Embed &amp; Protect</span>
          </>
        )}
      </button>

      {/* Download Action */}
      {downloadUrl && (
        <a
          ref={downloadRef}
          href={downloadUrl}
          download={downloadName}
          className="w-full py-2.5 px-4 flex items-center justify-center gap-2 font-semibold rounded-xl transition-all text-sm border hover:brightness-110 active:scale-[0.99] cursor-pointer"
          style={{
            backgroundColor: "rgb(35, 250, 56)",
            borderColor: "rgb(35, 250, 56)",
            color: "rgb(0, 0, 0)",
            boxShadow: "0 4px 16px rgba(35, 250, 56, 0.4)",
          }}
        >
          <Download className="w-4 h-4" />
          <span>Download Stego Image ({downloadName})</span>
        </a>
      )}
    </form>
  );
}

