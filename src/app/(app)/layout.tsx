import { LeftNav } from "@/components/layout/LeftNav";
import { TopBar } from "@/components/layout/TopBar";
import { DemoUserProvider } from "@/lib/context/demo-user";
import { AuthGuard } from "@/components/layout/AuthGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoUserProvider>
      <AuthGuard>
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
          <TopBar />
          <div className="flex flex-1 overflow-hidden">
            <LeftNav />
            <main id="main-content" className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </AuthGuard>
    </DemoUserProvider>
  );
}
