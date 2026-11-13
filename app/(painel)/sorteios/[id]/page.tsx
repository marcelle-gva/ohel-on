import SorteioAdminPanel from "@/components/sorteios/admin/SorteioAdminPanel";

export default async function SorteioAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SorteioAdminPanel sorteioId={id} />;
}
