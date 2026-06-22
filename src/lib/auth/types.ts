// Shared shape for a resolved server-side session user.
// Safe to import in both server components and "use client" components.
export interface ServerUser {
  id: string;
  display_name: string;
  role: string;
  tenant_id: string | null; // null = Reliance global admin
  job_title: string | null;
  company: string | null;   // null for Reliance admins
}
