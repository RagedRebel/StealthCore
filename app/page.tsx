"use client";

import { useState } from "react";
import EmbedForm from "@/components/EmbedForm";
import ExtractForm from "@/components/ExtractForm";

type Tab = "embed" | "extract";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("embed");

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              StealthCore
            </span>
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Secure data hiding using AES-256-GCM encryption &amp; LSB steganography.
            Hide any file inside a PNG image, protected by authenticated encryption.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-800/60 p-1 mb-8 border border-slate-700/50">
          <button
            onClick={() => setActiveTab("embed")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "embed"
                ? "bg-gradient-to-r from-cyan-600/80 to-blue-600/80 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🔒 Embed
          </button>
          <button
            onClick={() => setActiveTab("extract")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
              activeTab === "extract"
                ? "bg-gradient-to-r from-violet-600/80 to-purple-600/80 text-white shadow-lg shadow-violet-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🔓 Extract
          </button>
        </div>

        {/* Form Card */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm shadow-2xl">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-100">
              {activeTab === "embed" ? "Hide a File" : "Recover a File"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === "embed"
                ? "Select a PNG cover image, choose your secret file, and set a password."
                : "Upload the stego PNG image and enter the password used during embedding."}
            </p>
          </div>

          {activeTab === "embed" ? <EmbedForm /> : <ExtractForm />}
        </div>

        {/* Info Footer */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-cyan-400 text-lg mb-1">🛡️</div>
            <p className="text-xs text-slate-400">AES-256-GCM</p>
            <p className="text-[10px] text-slate-600">Authenticated Encryption</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-violet-400 text-lg mb-1">🔑</div>
            <p className="text-xs text-slate-400">PBKDF2</p>
            <p className="text-[10px] text-slate-600">100K Iterations</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="text-emerald-400 text-lg mb-1">🖼️</div>
            <p className="text-xs text-slate-400">LSB Stego</p>
            <p className="text-[10px] text-slate-600">Lossless PNG</p>
          </div>
        </div>
      </div>
    </main>
  );
}
