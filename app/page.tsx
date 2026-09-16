"use client";

import { useState } from "react";
import EmbedForm from "@/components/EmbedForm";
import ExtractForm from "@/components/ExtractForm";
import { Lock, Unlock, ShieldCheck, KeyRound, Image as ImageIcon, Shield } from "lucide-react";

type Tab = "embed" | "extract";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("embed");

  return (
    <main
      className="relative min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: "rgb(0, 0, 0)",
        color: "rgb(255, 255, 255)",
      }}
    >
      {/* Ambient background glow using palette RGB */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Ambient background glow using palette RGB */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[360px] blur-3xl opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(50, 50, 150, 0.35) 0%, rgba(255, 75, 75, 0.2) 45%, rgba(35, 250, 56, 0.12) 70%, transparent 85%)",
          }}
        />
      </div>

      <div className="relative max-w-xl w-full mx-auto px-4 pt-12 pb-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 border"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.5)",
              borderColor: "rgb(50, 50, 50)",
              color: "rgb(255, 255, 255)",
            }}
          >
            <Shield className="w-3.5 h-3.5" style={{ color: "rgb(35, 250, 56)" }} />
            <span>Encrypted Steganography</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-normal tracking-wide mb-2.5">
            <span
              className="font-brand-logo text-white"
              style={{
                fontFamily: '"Bitcount Grid Double", system-ui, sans-serif',
                fontWeight: 400,
                color: "rgb(255, 255, 255)",
              }}
            >
              StealthCore
            </span>
          </h1>
          <p
            className="text-sm max-w-md mx-auto leading-relaxed"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Conceal confidential files inside lossless PNG images with authenticated AES-256-GCM encryption.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          className="flex rounded-xl p-1 mb-6 border"
          style={{
            backgroundColor: "rgba(50, 50, 50, 0.45)",
            borderColor: "rgb(50, 50, 50)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("embed")}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border"
            style={{
              backgroundColor: activeTab === "embed" ? "rgb(50, 50, 150)" : "transparent",
              borderColor: activeTab === "embed" ? "rgb(50, 50, 150)" : "transparent",
              color: activeTab === "embed" ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.65)",
              boxShadow: activeTab === "embed" ? "0 4px 12px rgba(50, 50, 150, 0.4)" : "none",
            }}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Embed Secret</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("extract")}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer border"
            style={{
              backgroundColor: activeTab === "extract" ? "rgb(255, 75, 75)" : "transparent",
              borderColor: activeTab === "extract" ? "rgb(255, 75, 75)" : "transparent",
              color: activeTab === "extract" ? "rgb(255, 255, 255)" : "rgba(255, 255, 255, 0.65)",
              boxShadow: activeTab === "extract" ? "0 4px 12px rgba(255, 75, 75, 0.4)" : "none",
            }}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>Extract Secret</span>
          </button>
        </div>

        {/* Main Card */}
        <div
          className="rounded-2xl p-6 sm:p-7 backdrop-blur-xl border shadow-2xl"
          style={{
            backgroundColor: "rgba(50, 50, 50, 0.35)",
            borderColor: "rgb(50, 50, 50)",
          }}
        >
          <div
            className="mb-6 pb-4 border-b"
            style={{ borderColor: "rgba(50, 50, 50, 0.8)" }}
          >
            <h2
              className="text-base font-semibold flex items-center gap-2"
              style={{ color: "rgb(255, 255, 255)" }}
            >
              {activeTab === "embed" ? (
                <>
                  <Lock className="w-4 h-4" style={{ color: "rgb(50, 50, 150)" }} />
                  <span>Hide File in Carrier Image</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" style={{ color: "rgb(255, 75, 75)" }} />
                  <span>Recover File from Stego Image</span>
                </>
              )}
            </h2>
            <p
              className="text-xs mt-1 leading-normal"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              {activeTab === "embed"
                ? "Select a PNG cover image, attach any file to hide, and choose an encryption password."
                : "Upload the carrier PNG image and enter the password used to encrypt the payload."}
            </p>
          </div>

          {activeTab === "embed" ? <EmbedForm /> : <ExtractForm />}
        </div>

        {/* Feature Security Cards */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div
            className="p-3 rounded-xl border flex flex-col items-center"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.35)",
              borderColor: "rgb(50, 50, 50)",
            }}
          >
            <ShieldCheck className="w-4 h-4 mb-1.5" style={{ color: "rgb(50, 50, 150)" }} />
            <p className="text-xs font-medium" style={{ color: "rgb(255, 255, 255)" }}>
              AES-256-GCM
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Authenticated Cipher
            </p>
          </div>

          <div
            className="p-3 rounded-xl border flex flex-col items-center"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.35)",
              borderColor: "rgb(50, 50, 50)",
            }}
          >
            <KeyRound className="w-4 h-4 mb-1.5" style={{ color: "rgb(255, 75, 75)" }} />
            <p className="text-xs font-medium" style={{ color: "rgb(255, 255, 255)" }}>
              PBKDF2
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              100K Hash Rounds
            </p>
          </div>

          <div
            className="p-3 rounded-xl border flex flex-col items-center"
            style={{
              backgroundColor: "rgba(50, 50, 50, 0.35)",
              borderColor: "rgb(50, 50, 50)",
            }}
          >
            <ImageIcon className="w-4 h-4 mb-1.5" style={{ color: "rgb(35, 250, 56)" }} />
            <p className="text-xs font-medium" style={{ color: "rgb(255, 255, 255)" }}>
              LSB Stego
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
              Lossless PNG Carrier
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="py-4 text-center text-xs border-t"
        style={{
          borderColor: "rgb(50, 50, 50)",
          color: "rgba(255, 255, 255, 0.4)",
        }}
      >
        <span
          className="font-brand-logo tracking-wider"
          style={{
            fontFamily: '"Bitcount Grid Double", system-ui, sans-serif',
            color: "rgba(255, 255, 255, 0.7)",
          }}
        >
          StealthCore
        </span>{" "}
        &bull; Private, Zero-Retention Steganography
      </footer>
    </main>
  );
}
