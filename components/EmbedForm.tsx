"use client";

import { useState, useRef, type FormEvent, type ChangeEvent } from "react";

export default function EmbedForm() {
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [secretFile, setSecretFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("stego.png");
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);

  const [copied, setCopied] = useState(false);

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

  function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);

    if (file && !file.name.toLowerCase().endsWith(".png") && file.type !== "image/png") {
      setError("Cover image must be a PNG file. JPEG and other lossy formats will corrupt the hidden data.");
      setCoverImage(null);
      return;
    }
    setCoverImage(file);
  }

  function handleSecretChange(e: ChangeEvent<HTMLInputElement>) {
    setSecretFile(e.target.files?.[0] ?? null);
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);

    if (!coverImage || !secretFile || !password) {
      setError("All fields are required: cover image, secret file, and password.");
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
        setError(errorData.error || "An unknown error occurred.");
        return;
      }

      // Success — create download URL from blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `stego_${coverImage.name}`;

      setDownloadUrl(url);
      setDownloadName(filename);
      setSuccessInfo(
        `Secret file "${secretFile.name}" (${formatBytes(secretFile.size)}) successfully embedded into "${coverImage.name}". Download the stego image below.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Cover Image Input */}
      <div>
        <label htmlFor="embed-cover" className="block text-sm font-medium text-slate-300 mb-1.5">
          Cover Image (PNG only)
        </label>
        <input
          id="embed-cover"
          type="file"
          accept="image/png,.png"
          onChange={handleCoverChange}
          className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-medium file:bg-slate-700 file:text-slate-200
            hover:file:bg-slate-600 file:cursor-pointer file:transition-colors
            text-slate-400 cursor-pointer"
        />
        {coverImage && (
          <p className="mt-1 text-xs text-slate-500">
            {coverImage.name} ({formatBytes(coverImage.size)})
          </p>
        )}
      </div>

      {/* Secret File Input */}
      <div>
        <label htmlFor="embed-secret" className="block text-sm font-medium text-slate-300 mb-1.5">
          Secret File (any format)
        </label>
        <input
          id="embed-secret"
          type="file"
          onChange={handleSecretChange}
          className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-medium file:bg-slate-700 file:text-slate-200
            hover:file:bg-slate-600 file:cursor-pointer file:transition-colors
            text-slate-400 cursor-pointer"
        />
        {secretFile && (
          <p className="mt-1 text-xs text-slate-500">
            {secretFile.name} ({formatBytes(secretFile.size)})
          </p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="embed-password" className="block text-sm font-medium text-slate-300">
            Encryption Password
          </label>
          <button
            type="button"
            onClick={handleGeneratePassword}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            🔑 Generate Password (16-char)
          </button>
        </div>
        <div className="relative">
          <input
            id="embed-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter or generate a strong password"
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg
              text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2
              focus:ring-cyan-500/50 focus:border-cyan-500 transition-all pr-28"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {password && (
              <button
                type="button"
                onClick={handleCopyPassword}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                title="Copy password"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Success Display */}
      {successInfo && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          {successInfo}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !coverImage || !secretFile || !password}
        className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600
          hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700
          disabled:text-slate-500 text-white font-medium rounded-lg transition-all
          focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer
          disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Embedding...
          </span>
        ) : (
          "Embed & Protect"
        )}
      </button>

      {/* Download Link */}
      {downloadUrl && (
        <a
          ref={downloadRef}
          href={downloadUrl}
          download={downloadName}
          className="block w-full py-3 px-4 text-center bg-emerald-600 hover:bg-emerald-500
            text-white font-medium rounded-lg transition-colors"
        >
          ⬇ Download Stego Image
        </a>
      )}
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
