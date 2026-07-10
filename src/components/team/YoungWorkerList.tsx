"use client";

import { useEffect, useState } from "react";

type YoungWorkerRow = {
  id: string;
  workerName: string;
  age: number;
  classification: string;
  workPermitExpiryDate: string | null;
  status: "valid" | "expiring" | "expired" | "missing";
};

export function YoungWorkerList() {
  const [rows, setRows] = useState<YoungWorkerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/young-workers")
      .then((res) => {
        if (!res.ok) throw new Error("load-failed");
        return res.json();
      })
      .then((data: YoungWorkerRow[]) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled)
          setError("We couldn't load young worker profiles. Please refresh the page.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!rows) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading young worker profiles…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded border border-dashed p-8 text-center">
        <p className="font-medium">No young worker profiles yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add a profile for any employee under 18 to enable the task-assignment safety gate.
        </p>
        <a
          href="/team/young-workers/new"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Young Worker Profile
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-2 text-left">Worker</th>
            <th className="p-2 text-left">Age</th>
            <th className="p-2 text-left">Classification</th>
            <th className="p-2 text-left">Permit Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.workerName}</td>
              <td className="p-2">{r.age}</td>
              <td className="p-2 capitalize">{r.classification.replace(/_/g, " ")}</td>
              <td className="p-2">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: YoungWorkerRow["status"] }) {
  const map: Record<YoungWorkerRow["status"], { label: string; icon: string; classes: string }> = {
    valid: { label: "Valid", icon: "✅", classes: "bg-green-100 text-green-800" },
    expiring: { label: "Expiring soon", icon: "⚠️", classes: "bg-amber-100 text-amber-800" },
    expired: { label: "Expired", icon: "⛔", classes: "bg-red-100 text-red-800" },
    missing: { label: "Missing", icon: "❗", classes: "bg-gray-100 text-gray-800" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${s.classes}`}
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
