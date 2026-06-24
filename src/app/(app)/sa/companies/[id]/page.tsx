import { notFound } from "next/navigation";
import { getTenantDetail } from "@/lib/data/saRepo";
import CompanyDetailClient from "./CompanyDetailClient";

// Server component: load the real tenant detail (RLS-gated to Reliance
// superadmins) and hand it to the client view. No mock data — getTenantDetail
// returns null in MOCK_MODE or when the tenant doesn't exist / isn't visible.
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getTenantDetail(id);
  if (!detail) notFound();

  return <CompanyDetailClient detail={detail} />;
}
