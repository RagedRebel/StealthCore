"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
};

type Pulse = {
  a: number;
  b: number;
  t: number;
  speed: number;
};

const LINK_DIST = 130;
const MAX_PULSES = 14;
// Strict black-and-white palette only.
const LINE_ALPHA = 0.12;
const NODE_ALPHA_MIN = 0.18;
const NODE_ALPHA_VAR = 0.22;

function nodeCountForArea(w: number, h: number): number {
  const count = Math.floor((w * h) / 22000);
  return Math.min(70, Math.max(25, count));
}

export default function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let nodes: Node[] = [];
    let pulses: Pulse[] = [];
    let raf = 0;
    let running = true;
    let lastT = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const seed = () => {
      nodes = Array.from({ length: nodeCountForArea(w, h) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: 1 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
      }));
      pulses = [];
    };

    const neighborsOf = (index: number): number[] => {
      const out: number[] = [];
      const a = nodes[index];
      for (let j = 0; j < nodes.length; j++) {
        if (j === index) continue;
        const b = nodes[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) <= LINK_DIST) out.push(j);
      }
      return out;
    };

    const spawnPulse = () => {
      if (pulses.length >= MAX_PULSES || nodes.length < 2) return;
      const a = Math.floor(Math.random() * nodes.length);
      const neighbors = neighborsOf(a);
      if (neighbors.length === 0) return;
      const b = neighbors[Math.floor(Math.random() * neighbors.length)];
      pulses.push({
        a,
        b,
        t: 0,
        // Cross the link in roughly 0.9–1.6s.
        speed: 0.0006 + Math.random() * 0.0005,
      });
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // Links between nearby nodes.
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > LINK_DIST) continue;
          const alpha = LINE_ALPHA * (1 - dist / LINK_DIST);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Data pulses flowing along links.
      for (const p of pulses) {
        const a = nodes[p.a];
        const b = nodes[p.b];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        // Fade in/out at the ends so pulses emerge from the nodes.
        const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, p.t)));
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.55 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Nodes as plain dots with a gentle shimmer. No halo.
      for (const n of nodes) {
        const shimmer = 0.5 + 0.5 * Math.sin(t / 900 + n.phase);
        const alpha = NODE_ALPHA_MIN + NODE_ALPHA_VAR * shimmer;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (t: number) => {
      if (!running) return;
      const dt = lastT ? Math.min(50, t - lastT) : 16.67;
      lastT = t;
      const drift = dt / 16.67;

      for (const n of nodes) {
        n.x += n.vx * drift;
        n.y += n.vy * drift;
        if (n.x < -10) n.x = w + 10;
        if (n.x > w + 10) n.x = -10;
        if (n.y < -10) n.y = h + 10;
        if (n.y > h + 10) n.y = -10;
      }

      // Advance pulses; drop finished ones and trickle in new ones.
      for (const p of pulses) p.t += p.speed * dt;
      pulses = pulses.filter((p) => p.t < 1);
      if (Math.random() < 0.08 * drift) spawnPulse();

      draw(t);
      raf = requestAnimationFrame(step);
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (reduced) draw(0);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced && !running) {
        running = true;
        lastT = 0;
        raf = requestAnimationFrame(step);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (!reduced) raf = requestAnimationFrame(step);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className="neural-bg" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="neural-bg-vignette" />
    </div>
  );
}
