import { notFound } from "next/navigation";
import { getCell, currentUser } from "@/lib/data/repo";
import { TopBar } from "@/components/layout/TopBar";
import { CellDetail } from "@/components/cells/CellDetail";

export default async function CellPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cell = await getCell(id);
  if (!cell) notFound();
  return (
    <>
      <TopBar />
      <CellDetail id={id} role={currentUser().role} />
    </>
  );
}
