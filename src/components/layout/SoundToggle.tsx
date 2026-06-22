"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const KEY = "safetyiq_sounds_muted";

export function SoundToggle() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(localStorage.getItem(KEY) === "true");
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(KEY, next ? "true" : "false");
  }

  return (
    <button
      onClick={toggle}
      title={muted ? "Sounds muted — click to unmute" : "Sounds on — click to mute"}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
    >
      {muted
        ? <VolumeX className="h-4 w-4 text-slate-400" />
        : <Volume2 className="h-4 w-4" />
      }
    </button>
  );
}
