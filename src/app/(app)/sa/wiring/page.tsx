"use client";

export default function WiringBoardPage() {
  return (
    <div className="flex h-full flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>
      <iframe
        src="/wiring-board.html"
        title="Signal Wiring Board"
        className="flex-1 w-full border-0"
        style={{ minHeight: 800 }}
      />
    </div>
  );
}
