"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";

export default function ImprimirMembroPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [membro, setMembro] = useState<any>(null);
  const [congregacao, setCongregacao] = useState<any>(null);
  const [igreja, setIgreja] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDados = async () => {
      if (!id) return;
      
      const { data } = await supabase
        .from("membros")
        .select(`*, congregacoes (nome, endereco, cnpj), igrejas (nome, logo_url)`)
        .eq("id", id)
        .single();

      if (data) {
        setMembro(data);
        setCongregacao(data.congregacoes);
        setIgreja(data.igrejas);
      }
      setLoading(false);
    };
    fetchDados();
  }, [id]);

  if (loading) return <div className="p-10 text-center">Carregando ficha...</div>;
  if (!membro) return <div className="p-10 text-center">Membro não encontrado.</div>;

  const formatarData = (data: string) => {
    if (!data) return "____/____/________";
    return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="w-full min-h-screen bg-gray-200 print:bg-white flex justify-center py-8 print:py-0">
      
      <div className="fixed top-4 right-4 print:hidden flex gap-3 z-50">
        <button onClick={() => window.close()} className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 shadow">Fechar</button>
        <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700">Imprimir Ficha</button>
      </div>

      <div className="w-[210mm] min-h-[297mm] bg-white text-black p-10 shadow-lg print:shadow-none print:w-full print:min-h-0 print:p-0 flex flex-col justify-between">
        
        <div>
          {/* Cabeçalho da Igreja */}
          <div className="flex items-center gap-6 border-b-2 border-gray-800 pb-4 mb-6">
            {igreja?.logo_url && (
              <div className="relative w-40 h-24">
                <Image src={igreja.logo_url} alt="Logo da Igreja" fill className="object-contain object-left" />
              </div>
            )}
            <div className={`flex-1 ${igreja?.logo_url ? "border-l-2 border-gray-300 pl-6" : ""}`}>
              <h1 className="text-2xl font-bold uppercase">{igreja?.nome || congregacao?.nome}</h1>
              <p className="text-sm mt-1">CNPJ: {congregacao?.cnpj || "00.000.000/0000-00"}</p>
              <p className="text-sm">{congregacao?.endereco || "Endereço da Igreja"}</p>
            </div>
          </div>

          {/* Título */}
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold uppercase border-b border-gray-400 inline-block pb-1">Ficha de Cadastro de Membro</h2>
            <p className="text-sm mt-2">Código do Membro: <strong>{membro.codigo_membro || "-"}</strong></p>
          </div>

          {/* Dados Pessoais */}
          <div className="mb-6">
            <h3 className="bg-gray-200 font-bold px-2 py-1 text-sm uppercase mb-3">1. Dados Pessoais</h3>
            <div className="grid grid-cols-12 gap-y-4 gap-x-4 text-sm">
              <div className="col-span-12 border-b border-gray-400 flex gap-2"><span className="font-semibold w-24">Nome:</span> <span className="flex-1">{membro.nome}</span></div>
              <div className="col-span-4 border-b border-gray-400 flex gap-2"><span className="font-semibold">Nascimento:</span> <span>{formatarData(membro.data_nascimento)}</span></div>
              <div className="col-span-4 border-b border-gray-400 flex gap-2"><span className="font-semibold">Sexo:</span> <span>{membro.sexo || "-"}</span></div>
              <div className="col-span-4 border-b border-gray-400 flex gap-2"><span className="font-semibold">Est. Civil:</span> <span>{membro.estado_civil || "-"}</span></div>
              <div className="col-span-6 border-b border-gray-400 flex gap-2"><span className="font-semibold">CPF:</span> <span>{membro.cpf || "-"}</span></div>
              <div className="col-span-6 border-b border-gray-400 flex gap-2"><span className="font-semibold">Telefone:</span> <span>{membro.telefone || "-"}</span></div>
              <div className="col-span-12 border-b border-gray-400 flex gap-2"><span className="font-semibold w-24">E-mail:</span> <span className="flex-1">{membro.email || "-"}</span></div>
            </div>
          </div>

          {/* Endereço */}
          <div className="mb-6">
            <h3 className="bg-gray-200 font-bold px-2 py-1 text-sm uppercase mb-3">2. Endereço</h3>
            <div className="grid grid-cols-12 gap-y-4 gap-x-4 text-sm">
              <div className="col-span-8 border-b border-gray-400 flex gap-2"><span className="font-semibold">Logradouro:</span> <span>{membro.logradouro || "-"}</span></div>
              <div className="col-span-4 border-b border-gray-400 flex gap-2"><span className="font-semibold">Número:</span> <span>{membro.numero || "-"}</span></div>
              <div className="col-span-6 border-b border-gray-400 flex gap-2"><span className="font-semibold">Bairro:</span> <span>{membro.bairro || "-"}</span></div>
              <div className="col-span-4 border-b border-gray-400 flex gap-2"><span className="font-semibold">Cidade:</span> <span>{membro.cidade || "-"}</span></div>
              <div className="col-span-2 border-b border-gray-400 flex gap-2"><span className="font-semibold">UF:</span> <span>{membro.uf || "-"}</span></div>
            </div>
          </div>

          {/* Dados Eclesiásticos */}
          <div className="mb-10">
            <h3 className="bg-gray-200 font-bold px-2 py-1 text-sm uppercase mb-3">3. Dados Eclesiásticos</h3>
            <div className="grid grid-cols-12 gap-y-4 gap-x-4 text-sm">
              <div className="col-span-6 border-b border-gray-400 flex gap-2"><span className="font-semibold">Congregação:</span> <span>{congregacao?.nome || "-"}</span></div>
              <div className="col-span-3 border-b border-gray-400 flex gap-2"><span className="font-semibold">Cargo:</span> <span>{membro.cargo || "-"}</span></div>
              <div className="col-span-3 border-b border-gray-400 flex gap-2"><span className="font-semibold">Batismo:</span> <span>{formatarData(membro.data_batismo)}</span></div>
            </div>
          </div>

          {/* Assinaturas */}
          <div className="mt-20 grid grid-cols-2 gap-10 text-center text-sm">
            <div><div className="border-t border-black w-full mb-1"></div><p>Assinatura do Membro</p></div>
            <div><div className="border-t border-black w-full mb-1"></div><p>Secretaria / Dirigente</p></div>
          </div>
        </div>

        {/* RODAPÉ LGPD E COPYRIGHT DO SISTEMA */}
        <div className="mt-8 pt-4 border-t border-gray-300 flex justify-between items-end">
          <div className="text-[9px] text-gray-500 text-justify w-3/4 pr-4 leading-tight">
            <p>
              <strong>Termo de Consentimento LGPD:</strong> Declaro estar ciente e de acordo com a coleta e tratamento dos meus dados pessoais pela igreja, exclusivamente para fins de organização interna, secretaria e atividades ministeriais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
            </p>
          </div>
          
          <div className="flex flex-col items-center justify-end w-1/4">
            {/* A NOSSA LOGO (OHEL ON) FICA FIXA AQUI NO RODAPÉ */}
            <div className="relative w-24 h-10 opacity-70">
              <Image src="/logo-sistema.png" alt="OHEL ON" fill className="object-contain" />
            </div>
            <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-center">
              © {new Date().getFullYear()} OHEL ON<br/>Gestão Eclesiástica
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}