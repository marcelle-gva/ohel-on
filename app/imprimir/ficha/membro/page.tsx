"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Printer, ArrowLeft } from "lucide-react";

export default function ImprimirFichaMembro() {
  const router = useRouter();
  const [igreja, setIgreja] = useState<any>(null);

  useEffect(() => {
    const fetchIgreja = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session.user.id).maybeSingle();
        if (user) {
          const { data } = await supabase.from('igrejas').select('*').eq('id', user.igreja_id).single();
          if (data) setIgreja(data);
        }
      }
    };
    fetchIgreja();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full min-h-screen bg-gray-200 print:bg-white flex flex-col items-center py-8 print:py-0">
      
      {/* Botões do Topo (Somem na impressão) */}
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-black font-medium text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-colors">
          <Printer className="w-4 h-4" /> Imprimir Ficha
        </button>
      </div>

      {/* A Folha A4 */}
      <div className="w-[210mm] min-h-[297mm] bg-white text-black p-10 shadow-2xl print:shadow-none print:w-full print:min-h-0 print:p-0 font-sans">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-center gap-4">
            {igreja?.logo_url ? (
              <div className="relative w-32 h-16">
                <Image src={igreja.logo_url} alt="Logo da Igreja" fill className="object-contain object-left" />
              </div>
            ) : (
              <div className="w-24 h-16 bg-gray-100 flex items-center justify-center border border-gray-300 text-xs text-gray-400">LOGO</div>
            )}
            <div>
              <h1 className="text-xl font-bold uppercase">{igreja?.nome || "IGREJA"}</h1>
            </div>
          </div>
          <div className="text-[10px] text-gray-600 leading-tight text-right">
            <p><strong>CNPJ:</strong> {igreja?.cnpj || "00.000.000/0000-00"}</p>
            <p>{igreja?.endereco || "Endereço da Igreja"}</p>
            <p><strong>E-mail:</strong> {igreja?.email || "email@igreja.com"}</p>
            <p><strong>Tel:</strong> {igreja?.telefone || "(00) 0000-0000"}</p>
          </div>
        </div>

        {/* Título */}
        <h2 className="text-lg font-bold uppercase mb-4">FICHA CADASTRAL DE MEMBROS</h2>

        {/* SESSÃO 1: DADOS PESSOAIS */}
        <div className="mb-4">
          <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Pessoais</h3>
          
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex gap-2 items-end">
              <span className="font-semibold w-24">Nome Completo:</span>
              <div className="flex-1 border-b border-gray-400 h-5"></div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Data de Nascimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Sexo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-28">Tipo Sanguíneo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Nacionalidade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>

            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Naturalidade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">País de Origem:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Estado Civil:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>

            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">CPF:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">RG:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">E-mail:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>

            <div className="flex gap-2 items-end">
              <span className="font-semibold w-32">Telefone / WhatsApp:</span>
              <div className="flex-1 border-b border-gray-400 h-5"></div>
            </div>
          </div>
        </div>

        {/* SESSÃO 2: ENDEREÇO */}
        <div className="mb-4">
          <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Endereço</h3>
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">CEP:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-32">Logradouro (Rua/Av):</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-8">Nº:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">Compl.:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Bairro:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Cidade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-8">UF:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>
          </div>
        </div>

        {/* SESSÃO 3: FILIAÇÃO */}
        <div className="mb-4">
          <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Filiação</h3>
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex gap-2 items-end">
              <span className="font-semibold w-24">Nome do Pai:</span>
              <div className="flex-1 border-b border-gray-400 h-5"></div>
            </div>
            <div className="flex gap-2 items-end">
              <span className="font-semibold w-24">Nome da Mãe:</span>
              <div className="flex-1 border-b border-gray-400 h-5"></div>
            </div>
          </div>
        </div>

        {/* SESSÃO 4: DADOS FAMILIARES */}
        <div className="mb-4">
          <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Familiares</h3>
          <div className="flex gap-4 text-xs">
            <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Cônjuge é membro?</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-32">Nome do Cônjuge:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Casamento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
          </div>
        </div>

        {/* SESSÃO 5: DADOS ECLESIÁSTICOS */}
        <div className="mb-4">
          <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Eclesiásticos</h3>
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Congregação Atual:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-20">Situação:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-36">Forma de Recebimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Recebimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Conversão:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Batismo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-36">Batismo Esp. Santo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-32">Igreja de Batismo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>
            <div className="flex gap-2 items-end">
              <span className="font-semibold w-40">Cidade/Estado do Batismo:</span>
              <div className="flex-1 border-b border-gray-400 h-5"></div>
            </div>
            <div className="flex gap-4">
              <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-36">Data de Transferência:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-32">Igreja de Origem:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
            </div>
            <div className="flex gap-2 items-end">
              <span className="font-semibold w-40">Cidade/Estado de Origem:</span>
              <div className="flex-1 border-b border-gray-400 h-5"></div>
            </div>
          </div>
        </div>

        {/* SESSÃO 6: OBSERVAÇÕES */}
        <div className="mb-8">
          <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Observações</h3>
          <div className="border border-gray-400 rounded h-24"></div>
        </div>

        {/* RODAPÉ LGPD */}
        <div className="border-t border-gray-300 pt-3 text-[9px] text-gray-500 text-justify mt-10">
          <p>
            <strong>Termo de Consentimento LGPD:</strong> Declaro estar ciente e de acordo com a coleta e tratamento dos meus dados pessoais pela igreja, exclusivamente para fins de organização interna, secretaria e atividades ministeriais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
          <div className="flex justify-between mt-8">
            <div className="w-1/3 border-t border-black text-center pt-1">Assinatura do Membro</div>
            <div className="w-1/3 border-t border-black text-center pt-1">Secretaria / Dirigente</div>
          </div>
        </div>

      </div>
    </div>
  );
}