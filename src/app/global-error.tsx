"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#f8fafc" }}>
        <div style={{ textAlign: "center", padding: 32 }}>
          <h2 style={{ color: "#1e293b", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>The application hit an unexpected error.</p>
          <button onClick={() => reset()} style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: 0, borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
