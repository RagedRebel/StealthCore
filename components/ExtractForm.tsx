"use client";

import { useState, type FormEvent } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Unlock,
  FileCheck,
  HardDrive,
  Key,
} from "lucide-react";
import FileDropzone from "./FileDropzone";
import {
  getPngDimensions,
  calculateMaxCapacity,
  formatBytes,
} from "@/lib/capacity";

type CryptoMode = "password" | "rsa";

export default function ExtractForm() {
  const [cryptoMode, setCryptoMode] = useState<CryptoMode>("password");
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [stegoDimensions, setStegoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("recovered_file");
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  async function handleStegoChange(file: File | null) {
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);
    setStegoDimensions(null);

    if (file && !file.name.toLowerCase().endsWith(".png") && file.type !== "image/png") {
      setError("Stego image must be a PNG file.");
      setStegoImage(null);
      return;
    }
    setStegoImage(file);

    if (file) {
      const dims = await getPngDimensions(file);
      setStegoDimensions(dims);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDownloadUrl(null);
    setSuccessInfo(null);

    if (!stegoImage) {
      setError("Stego image is required.");
      return;
    }

    if (cryptoMode === "password" && !password) {
      setError("Decryption password is required.");
      return;
    }

    if (cryptoMode === "rsa" && !privateKey.trim()) {
      setError("RSA private key is required.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("stegoImage", stegoImage);
      if (cryptoMode === "rsa") {
        formData.append("privateKey", privateKey.trim());
      } else {
        formData.append("password", password);
      }

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "An error occurred during extraction.");
        return;
      }

      const originalFilename =
        response.headers.get("X-Original-Filename") || "recovered_file";

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      setDownloadUrl(url);
      setDownloadName(originalFilename);
      setSuccessInfo(
        `Successfully decrypted with ${
          cryptoMode === "rsa" ? "RSA-2048 private key" : "AES password"
        } and extracted "${originalFilename}" (${formatBytes(blob.size)}).`
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
    stegoImage &&
      (cryptoMode === "rsa" ? privateKey.trim().length > 0 : password.length > 0)
  );

  const maxStegoBytes = stegoDimensions
    ? calculateMaxCapacity(stegoDimensions.width, stegoDimensions.height)
    : 0;
  const megapixels = stegoDimensions
    ? ((stegoDimensions.width * stegoDimensions.height) / 1_000_000).toFixed(2)
    : "0";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Stego Image Input */}
      <div className="space-y-2">
        <FileDropzone
          id="extract-stego"
          label="Stego Image"
          hint="PNG with hidden data"
          accept=".png,image/png"
          file={stegoImage}
          onFileSelect={handleStegoChange}
          isImage={true}
          accentColor="coral"
          extraBadge={
            stegoDimensions ? (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                style={{
                  backgroundColor: "rgba(255, 75, 75, 0.15)",
                  borderColor: "rgba(255, 75, 75, 0.4)",
                  color: "rgb(255, 180, 180)",
                }}
              >
                Max: {formatBytes(maxStegoBytes)}
              </span>
            ) : null
          }
        />

        {/* Carrier Info Card */}
        {stegoImage && stegoDimensions && (
          <div
            className="p-3 rounded-xl border flex items-center justify-between text-xs"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.35)",
              borderColor: "rgba(255, 75, 75, 0.3)",
            }}
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 shrink-0" style={{ color: "rgb(255, 75, 75)" }} />
              <span style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                Carrier holds up to{" "}
                <strong className="text-white font-mono">{formatBytes(maxStegoBytes)}</strong> hidden payload
              </span>
            </div>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-mono border"
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                borderColor: "rgba(255, 255, 255, 0.1)",
                color: "rgba(255, 255, 255, 0.75)",
              }}
            >
              {stegoDimensions.width} × {stegoDimensions.height} ({megapixels} MP)
            </span>
          </div>
        )}
      </div>

      {/* Decryption Mode Selector */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-white">Decryption Strategy</span>
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
                backgroundColor: cryptoMode === "password" ? "rgb(255, 75, 75)" : "transparent",
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
                backgroundColor: cryptoMode === "rsa" ? "rgb(255, 75, 75)" : "transparent",
                color: cryptoMode === "rsa" ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.6)",
              }}
            >
              RSA Private Key
            </button>
          </div>
        </div>

        {/* Password Mode Input */}
        {cryptoMode === "password" ? (
          <div>
            <label
              htmlFor="extract-password"
              className="block text-xs font-medium mb-1.5"
              style={{ color: "rgb(255, 255, 255)" }}
            >
              Decryption Password
            </label>
            <div className="relative flex items-center">
              <div
                className="absolute left-3.5 pointer-events-none"
                style={{ color: "rgba(255, 255, 255, 0.4)" }}
              >
                <Lock className="w-4 h-4" />
              </div>

              <input
                id="extract-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter the password used during embedding"
                className="w-full pl-10 pr-12 py-2.5 rounded-xl text-sm font-mono transition-all outline-none"
                style={{
                  backgroundColor: "rgba(50, 50, 50, 0.45)",
                  borderColor: "rgb(50, 50, 50)",
                  borderWidth: "1px",
                  borderStyle: "solid",
                  color: "rgb(255, 255, 255)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgb(255, 75, 75)";
                  e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255, 75, 75, 0.35)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgb(50, 50, 50)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : (
          /* RSA Private Key Mode */
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white">
              <Key className="w-3.5 h-3.5 text-red-400" />
              <label htmlFor="extract-private-key">Receiver's RSA Private Key (PEM)</label>
            </div>
            <textarea
              id="extract-private-key"
              rows={5}
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;Paste receiver's 2048-bit RSA private key here&#10;-----END PRIVATE KEY-----"
              className="w-full p-3 rounded-xl text-xs font-mono transition-all outline-none resize-none"
              style={{
                backgroundColor: "rgba(50, 50, 50, 0.45)",
                borderColor: "rgb(50, 50, 50)",
                borderWidth: "1px",
                borderStyle: "solid",
                color: "rgb(255, 255, 255)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgb(255, 75, 75)";
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(255, 75, 75, 0.35)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgb(50, 50, 50)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <p className="text-[11px] text-zinc-400">
              Paste the RSA private key corresponding to the public key used during embedding.
            </p>
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
          backgroundColor: isFormValid && !loading ? "rgb(255, 75, 75)" : "rgba(50, 50, 50, 0.5)",
          borderColor: isFormValid && !loading ? "rgb(255, 75, 75)" : "rgb(50, 50, 50)",
          color: isFormValid && !loading ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.4)",
          cursor: isFormValid && !loading ? "pointer" : "not-allowed",
          boxShadow: isFormValid && !loading ? "0 4px 14px rgba(255, 75, 75, 0.35)" : "none",
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Extracting &amp; Decrypting...</span>
          </>
        ) : (
          <>
            <Unlock className="w-4 h-4" />
            <span>Extract &amp; Decrypt</span>
          </>
        )}
      </button>

      {/* Download Action */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={downloadName}
          className="w-full py-2.5 px-4 flex items-center justify-center gap-2 font-medium rounded-xl transition-all text-sm border"
          style={{
            backgroundColor: "rgb(50, 50, 150)",
            borderColor: "rgb(50, 50, 150)",
            color: "rgb(255, 255, 255)",
            boxShadow: "0 4px 14px rgba(50, 50, 150, 0.35)",
          }}
        >
          <FileCheck className="w-4 h-4" />
          <span>Download Extracted File ({downloadName})</span>
        </a>
      )}
    </form>
  );
}
