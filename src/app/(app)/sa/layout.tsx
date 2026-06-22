export default function SaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {children}
    </div>
  );
}
