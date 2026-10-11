"use client";

import type { PlayerStatus, Speed } from "@/lib/whiteboard/player";

const SPEEDS: Speed[] = [0.75, 1, 1.25, 1.5];

export function Controls({
  status,
  onPlay,
  onPause,
  onResume,
  onStepBack,
  onStepForward,
  speed,
  onSpeedChange,
  zoom,
  onZoomChange,
  muted,
  onMuteToggle,
}: {
  status: PlayerStatus;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  speed: Speed;
  onSpeedChange: (speed: Speed) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  muted: boolean;
  onMuteToggle: () => void;
}) {
  const isPlaying = status === "playing";
  const canStepBack = status !== "idle";
  const canStepForward = status === "playing" || status === "paused" || status === "awaiting_check";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <button
        type="button"
        onClick={status === "paused" ? onResume : isPlaying ? onPause : onPlay}
        className="rounded-md border border-gold/50 bg-gold/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-navy hover:bg-gold/20"
      >
        {status === "idle" || status === "done" ? "Play" : isPlaying ? "Pause" : "Resume"}
      </button>
      <button
        type="button"
        disabled={!canStepBack}
        onClick={onStepBack}
        className="rounded-md border border-line px-3 py-1.5 text-mute disabled:opacity-40"
      >
        ◂ Step back
      </button>
      <button
        type="button"
        disabled={!canStepForward}
        onClick={onStepForward}
        className="rounded-md border border-line px-3 py-1.5 text-mute disabled:opacity-40"
      >
        Step forward ▸
      </button>

      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Speed
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value) as Speed)}
          className="rounded-md border border-line px-2 py-1"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        Zoom
        <input
          type="range"
          min={50}
          max={150}
          step={10}
          value={Math.round(zoom * 100)}
          onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
        />
        <span>{Math.round(zoom * 100)}%</span>
      </label>

      <button
        type="button"
        onClick={onMuteToggle}
        className="rounded-md border border-line px-3 py-1.5 text-mute"
        aria-pressed={muted}
      >
        {muted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}
