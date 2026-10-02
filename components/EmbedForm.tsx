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
  TableProperties,
  Key,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import FileDropzone from "./FileDropzone";
import CapacityGuideModal from "./CapacityGuideModal";
import QualityReportModal from "./QualityReportModal";
import CapacityWarningModal from "./CapacityWarningModal";
import {
  getPngDimensions,
  estimateMaxSecretFileSize,
  formatBytes,
} from "@/lib/capacity";

type CryptoMode = "password" | "rsa";

export default function EmbedForm() {
  const [cryptoMode, setCryptoMode] = useState<CryptoMode>("password");
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverDimensions, setCoverDimensions] = useState<{ width: number; height: number } | null>(null);
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string | null>(null);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"password" | "public" | "private" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("stego.png");
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ psnr: number | null; ssim: number } | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showQualityReport, setShowQualityReport] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState<{
    fileName: string;
    fileSize: number;
    maxBytes: number;
    coverDims?: { width: number; height: number } | null;
  } | null>(null);
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

  function handleCopy(text: string, type: "password" | "public" | "private") {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function handleGenerateRSAKeys() {
    setGeneratingKeys(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-keys");
      if (!res.ok) {
        throw new Error("Failed to generate RSA key pair");
      }
      const data = await res.json();
      setPublicKey(data.publicKey);
      setGeneratedPrivateKey(data.privateKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate keys.");
    } finally {
      setGeneratingKeys(false);
    }
  }

  async function handleCoverChange(file: File | null) {
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);
    setMetrics(null);
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

      // If user had already selected a secret file, verify it fits inside this new cover image
      if (dims && secretFile) {
        const maxAllowed = estimateMaxSecretFileSize(
          dims.width,
          dims.height,
          cryptoMode === "rsa"
        );
        if (maxAllowed > 0 && secretFile.size > maxAllowed) {
          setCapacityWarning({
            fileName: secretFile.name,
            fileSize: secretFile.size,
            maxBytes: maxAllowed,
            coverDims: dims,
          });
          setSecretFile(null);
        }
      }
    }
  }

  function handleSecretChange(file: File | null) {
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);
    setMetrics(null);

    if (!file) {
      setSecretFile(null);
      return;
    }

    // Check if cover image is present and calculate capacity before accepting/uploading
    if (coverDimensions) {
      const maxAllowed = estimateMaxSecretFileSize(
        coverDimensions.width,
        coverDimensions.height,
        cryptoMode === "rsa"
      );
      if (maxAllowed > 0 && file.size > maxAllowed) {
        setCapacityWarning({
          fileName: file.name,
          fileSize: file.size,
          maxBytes: maxAllowed,
          coverDims: coverDimensions,
        });
        setSecretFile(null);
        return;
      }
    }

    setSecretFile(file);
  }

  function handleTryDifferentFile() {
    setCapacityWarning(null);
    const secretInput = document.getElementById("embed-secret") as HTMLInputElement | null;
    if (secretInput) {
      secretInput.click();
    }
  }

  function handleChangeCover() {
    setCapacityWarning(null);
    const coverInput = document.getElementById("embed-cover") as HTMLInputElement | null;
    if (coverInput) {
      coverInput.click();
    }
  }

  const isRSA = cryptoMode === "rsa";
  const maxSecretBytes = coverDimensions
    ? estimateMaxSecretFileSize(coverDimensions.width, coverDimensions.height, isRSA)
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
    setMetrics(null);

    if (!coverImage || !secretFile) {
      setError("Cover image and secret file are required.");
      return;
    }

    if (cryptoMode === "password" && !password) {
      setError("Encryption password is required.");
      return;
    }

    if (cryptoMode === "rsa" && !publicKey.trim()) {
      setError("RSA public key is required. Generate a key pair or paste a public key.");
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
      if (cryptoMode === "rsa") {
        formData.append("publicKey", publicKey.trim());
      } else {
        formData.append("password", password);
      }

      const response = await fetch("/api/embed", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "An error occurred during embedding.");
        return;
      }

      const data = await response.json();
      setDownloadUrl(data.stegoImage);
      setDownloadName(data.filename || `stego_${coverImage.name}`);
      setMetrics({
        psnr: data.psnr,
        ssim: data.ssim,
      });
      setSuccessInfo(
        `Secret file "${secretFile.name}" (${formatBytes(secretFile.size)}) successfully encrypted via ${
          cryptoMode === "rsa" ? "RSA-2048 + AES-256-GCM" : "AES-256-GCM"
        } and embedded into "${coverImage.name}".`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const isFormValid = Boolean(
    coverImage &&
      secretFile &&
      (cryptoMode === "rsa" ? publicKey.trim().length > 0 : password.length > 0) &&
      !isOverCapacity
  );

  return (
    <>
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
                      Max Secret File Size ({cryptoMode === "rsa" ? "RSA mode" : "Password mode"})
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

          {/* Capacity Guide Trigger */}
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border text-xs font-medium transition-all cursor-pointer hover:brightness-125"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.35)",
              borderColor: "rgb(50, 50, 50)",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            <TableProperties className="w-3.5 h-3.5" />
            <span>View max capacity table</span>
          </button>
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

        {/* Encryption Mode Selector */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white">Encryption Strategy</span>
            <div
              className="flex rounded-lg p-0.5 border"
              style={{
                backgroundColor: "rgba(50, 50, 50, 0.5)",
                borderColor: "rgb(50, 50, 50)",
              }}
            >
              <button
                type="button"
                onClick={() => setCryptoMode("password")}
                className="px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: cryptoMode === "password" ? "rgb(50, 50, 150)" : "transparent",
                  color: cryptoMode === "password" ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.6)",
                }}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setCryptoMode("rsa")}
                className="px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: cryptoMode === "rsa" ? "rgb(50, 50, 150)" : "transparent",
                  color: cryptoMode === "rsa" ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.6)",
                }}
              >
                RSA Key Pair
              </button>
            </div>
          </div>

          {/* Password Mode Input */}
          {cryptoMode === "password" ? (
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
                      onClick={() => handleCopy(password, "password")}
                      className="p-1.5 rounded-lg transition-colors cursor-pointer"
                      style={{ color: "rgba(255, 255, 255, 0.6)" }}
                      title="Copy password"
                      aria-label="Copy password"
                    >
                      {copiedKey === "password" ? (
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
          ) : (
            /* RSA Key Pair Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="embed-public-key"
                  className="block text-xs font-medium text-white"
                >
                  Recipient's RSA Public Key (PEM)
                </label>
                <button
                  type="button"
                  onClick={handleGenerateRSAKeys}
                  disabled={generatingKeys}
                  className="text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ color: "rgb(35, 250, 56)" }}
                >
                  {generatingKeys ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating 2048-bit Key...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-3.5 h-3.5" />
                      <span>Generate RSA Key Pair</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <textarea
                  id="embed-public-key"
                  rows={4}
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                  placeholder="-----BEGIN PUBLIC KEY-----&#10;Paste receiver's 2048-bit RSA public key here&#10;-----END PUBLIC KEY-----"
                  className="w-full p-3 rounded-xl text-xs font-mono transition-all outline-none resize-none"
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
                {publicKey && (
                  <button
                    type="button"
                    onClick={() => handleCopy(publicKey, "public")}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 transition-colors cursor-pointer text-zinc-300"
                    title="Copy public key"
                  >
                    {copiedKey === "public" ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Generated Private Key Card */}
              {generatedPrivateKey && (
                <div
                  className="p-3 rounded-xl border text-xs space-y-2"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.08)",
                    borderColor: "rgba(245, 158, 11, 0.35)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>Receiver's Private Key (Keep Secret!)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedPrivateKey, "private")}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors cursor-pointer"
                    >
                      {copiedKey === "private" ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Private Key</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Copy and share this private key with the intended receiver through a secure channel. It is required to extract and decrypt the hidden file.
                  </p>
                  <textarea
                    readOnly
                    rows={3}
                    value={generatedPrivateKey}
                    className="w-full p-2 rounded-lg text-[10px] font-mono bg-black/40 border border-amber-500/20 text-amber-100/90 outline-none resize-none"
                  />
                </div>
              )}
            </div>
          )}
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
            className="p-3.5 rounded-xl border text-sm space-y-2.5"
            style={{
              backgroundColor: "rgba(35, 250, 56, 0.12)",
              borderColor: "rgba(35, 250, 56, 0.35)",
              color: "rgb(255, 255, 255)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <CheckCircle2
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "rgb(35, 250, 56)" }}
              />
              <div className="text-xs leading-relaxed">{successInfo}</div>
            </div>

            {/* Quality Evaluation Display */}
            {metrics && (
              <div
                className="pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                style={{ borderColor: "rgba(35, 250, 56, 0.25)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium" style={{ color: "rgba(255, 255, 255, 0.75)" }}>
                    Quality Metrics:
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-mono border"
                    style={{
                      backgroundColor: "rgba(35, 250, 56, 0.15)",
                      borderColor: "rgba(35, 250, 56, 0.4)",
                      color: "rgb(35, 250, 56)",
                    }}
                  >
                    PSNR: {metrics.psnr !== null ? `${metrics.psnr.toFixed(1)} dB` : "∞"}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded text-[11px] font-mono border"
                    style={{
                      backgroundColor: "rgba(35, 250, 56, 0.15)",
                      borderColor: "rgba(35, 250, 56, 0.4)",
                      color: "rgb(35, 250, 56)",
                    }}
                  >
                    SSIM: {metrics.ssim.toFixed(4)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQualityReport(true)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 border cursor-pointer hover:brightness-110 active:scale-95"
                  style={{
                    backgroundColor: "rgba(35, 250, 56, 0.15)",
                    borderColor: "rgba(35, 250, 56, 0.45)",
                    color: "rgb(35, 250, 56)",
                  }}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Quality Report</span>
                </button>
              </div>
            )}
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

      {/* Capacity Guide Popup */}
      {showGuide && <CapacityGuideModal onClose={() => setShowGuide(false)} />}

      {/* Quality Report Popup */}
      {showQualityReport && metrics && (
        <QualityReportModal
          psnr={metrics.psnr}
          ssim={metrics.ssim}
          onClose={() => setShowQualityReport(false)}
        />
      )}

      {/* Capacity Warning Popup */}
      {capacityWarning && (
        <CapacityWarningModal
          fileName={capacityWarning.fileName}
          fileSize={capacityWarning.fileSize}
          maxBytes={capacityWarning.maxBytes}
          coverDimensions={capacityWarning.coverDims}
          onClose={() => setCapacityWarning(null)}
          onTryDifferentFile={handleTryDifferentFile}
          onChangeCover={handleChangeCover}
        />
      )}
    </>
  );
}
