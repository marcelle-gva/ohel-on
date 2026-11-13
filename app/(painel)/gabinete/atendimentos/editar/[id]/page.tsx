"use client";

import { useParams } from "next/navigation";
import { AtendimentoForm } from "@/components/pastoral/AtendimentoForm";

export default function EditarAtendimentoPage() {
  const params = useParams<{ id: string }>();
  return <AtendimentoForm mode="editar" id={params.id} />;
}
