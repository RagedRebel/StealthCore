"use client";

import { useState, type FormEvent } from "react";

export default function ExtractForm() {
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("recovered_file");
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);

    if (!stegoImage || !password) {
      setError("Both the stego image and password are required.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("stegoImage", stegoImage);
      formData.append("password", password);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "An unknown error occurred.");
        return;
      }

      // Success — extract filename and create download link
      const originalFilename =
        response.headers.get("X-Original-Filename") || "recovered_file";

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setDownloadUrl(url);
      setDownloadName(originalFilename);
      setSuccessInfo(
        `Successfully extracted "${originalFilename}" (${formatBytes(blob.size)}). Download below.`
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
      {/* Stego Image Input */}
      <div>
        <label htmlFor="extract-stego" className="block text-sm font-medium text-slate-300 mb-1.5">
          Stego Image (PNG with hidden data)
        </label>
        <input
          id="extract-stego"
          type="file"
          accept="image/png,.png"
          onChange={(e) => {
            setStegoImage(e.target.files?.[0] ?? null);
            setError(null);
            setDownloadUrl(null);
            setSuccessInfo(null);
          }}
          className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-sm file:font-medium file:bg-slate-700 file:text-slate-200
            hover:file:bg-slate-600 file:cursor-pointer file:transition-colors
            text-slate-400 cursor-pointer"
        />
        {stegoImage && (
          <p className="mt-1 text-xs text-slate-500">
            {stegoImage.name} ({formatBytes(stegoImage.size)})
          </p>
        )}
      </div>

      {/* Password Input */}
      <div>
        <label htmlFor="extract-password" className="block text-sm font-medium text-slate-300 mb-1.5">
          Decryption Password
        </label>
        <div className="relative">
          <input
            id="extract-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter the password used during embedding"
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg
              text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2
              focus:ring-violet-500/50 focus:border-violet-500 transition-all pr-20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400
              hover:text-slate-200 transition-colors"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
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
        disabled={loading || !stegoImage || !password}
        className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600
          hover:from-violet-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700
          disabled:text-slate-500 text-white font-medium rounded-lg transition-all
          focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer
          disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Extracting...
          </span>
        ) : (
          "Extract & Decrypt"
        )}
      </button>

      {/* Download Link */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={downloadName}
          className="block w-full py-3 px-4 text-center bg-emerald-600 hover:bg-emerald-500
            text-white font-medium rounded-lg transition-colors"
        >
          ⬇ Download Recovered File ({downloadName})
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
