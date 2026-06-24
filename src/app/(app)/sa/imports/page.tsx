import { getImportJobs, getAllTenants } from "@/lib/data/saRepo";
import { ImportsClient } from "./ImportsClient";

export default async function SAImportsPage() {
  const [jobs, tenants] = await Promise.all([getImportJobs(), getAllTenants()]);
  return <ImportsClient jobs={jobs} tenants={tenants} />;
}
