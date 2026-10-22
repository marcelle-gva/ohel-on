"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import { Printer, ArrowLeft } from "lucide-react";

export default function ImprimirFichaPage() {
  const router = useRouter();
  const params = useParams();
  
  // Correção: Garante que o tipo seja lido como texto e em minúsculo
  const tipoUrl = params.tipo as string;
  const tipo = tipoUrl ? tipoUrl.toLowerCase() : "";

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

  // Cabeçalho padrão
  const Cabecalho = () => (
    <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
      <div className="flex items-center gap-4">
        {igreja?.logo_url ? (
          <div className="relative w-32 h-16">
            <Image src={igreja.logo_url} alt="Logo" fill className="object-contain object-left" />
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
  );

  // Rodapé padrão (LGPD + Assinaturas)
  const Rodape = ({ temAssinatura = true }: { temAssinatura?: boolean }) => (
    <div className="border-t border-gray-300 pt-3 text-[9px] text-gray-500 text-justify mt-10">
      <p>
        <strong>Termo de Consentimento LGPD:</strong> Declaro estar ciente e de acordo com a coleta e tratamento dos meus dados pessoais pela igreja, exclusivamente para fins de organização interna, secretaria e atividades ministeriais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </p>
      {temAssinatura && (
        <div className="flex justify-between mt-8">
          <div className="w-1/3 border-t border-black text-center pt-1">Assinatura do Declarante</div>
          <div className="w-1/3 border-t border-black text-center pt-1">Secretaria / Dirigente</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center">
      
      {/* Botões do Topo (Somem na impressão) */}
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 print:hidden">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white font-medium text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para Fichas
        </button>
        
        {/* Aviso de Debug caso o tipo não seja reconhecido (Ajuda a achar o erro) */}
        {!["membro", "batismo", "congregado", "visitante", "crianca"].includes(tipo) && (
          <div className="bg-red-500/20 text-red-400 px-4 py-2 rounded text-xs">
            Erro: Tipo "{tipo}" não reconhecido.
          </div>
        )}

        <button onClick={handlePrint} className="bg-ohel-blue hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg transition-colors">
          <Printer className="w-4 h-4" /> Imprimir Ficha
        </button>
      </div>

      {/* A Folha A4 */}
      <div className="w-[210mm] min-h-[297mm] bg-white text-black p-10 shadow-2xl print:shadow-none print:w-full print:min-h-0 print:p-0 font-sans">
        
        <Cabecalho />

        {/* 1. FICHA DE MEMBRO */}
        {tipo === "membro" && (
          <>
            <h2 className="text-lg font-bold uppercase mb-4">FICHA CADASTRAL DE MEMBROS</h2>
            <div className="mb-4">
              <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Pessoais</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Nome Completo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Nascimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Sexo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-28">Nacionalidade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">CPF:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">RG:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">E-mail:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-32">Telefone / WhatsApp:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Endereço</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-12">CEP:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-32">Logradouro:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-8">Nº:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Bairro:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Cidade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-8">UF:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Eclesiásticos</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Conversão:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Batismo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
              </div>
            </div>
            <div className="mb-8">
              <h3 className="bg-blue-100 text-blue-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Observações</h3>
              <div className="border border-gray-400 rounded h-24"></div>
            </div>
          </>
        )}

        {/* 2. FICHA DE BATISMO */}
        {tipo === "batismo" && (
          <>
            <h2 className="text-lg font-bold uppercase mb-4">FICHA DE CANDIDATO AO BATISMO</h2>
            <div className="mb-4">
              <h3 className="bg-cyan-100 text-cyan-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Pessoais</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Nome Completo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Nascimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Idade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Telefone:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Endereço:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="bg-cyan-100 text-cyan-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Histórico Eclesiástico</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data de Conversão:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Congregação:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-48">Já fez o discipulado?</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-[2]"><span className="font-semibold w-48">Participa de célula/EBD?</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
              </div>
            </div>
             <div className="mb-8">
              <h3 className="bg-cyan-100 text-cyan-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Termo de Fé e Compromisso</h3>
              <div className="border border-gray-400 rounded h-32 p-2 text-[10px] text-gray-500">
                Declaro publicamente minha fé em Jesus Cristo como meu único e suficiente Salvador, comprometendo-me a seguir os ensinamentos bíblicos e a doutrina desta igreja.
              </div>
            </div>
          </>
        )}

        {/* 3. FICHA DE CONGREGADO */}
        {tipo === "congregado" && (
          <>
            <h2 className="text-lg font-bold uppercase mb-4">FICHA DE CADASTRO DE CONGREGADO</h2>
            <div className="mb-4">
              <h3 className="bg-green-100 text-green-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados Pessoais</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Nome Completo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Nascimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Telefone:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Congregação:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Endereço:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="bg-green-100 text-green-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Informações Familiares</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Nome do Cônjuge:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-32">Filhos (Nomes e Idades):</span><div className="flex-1 border-b border-gray-400 h-10"></div></div>
              </div>
            </div>
            <div className="mb-8">
              <h3 className="bg-green-100 text-green-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Observações</h3>
              <div className="border border-gray-400 rounded h-20"></div>
            </div>
          </>
        )}

        {/* 4. FICHA DE VISITANTE */}
        {tipo === "visitante" && (
          <>
            <h2 className="text-lg font-bold uppercase mb-4">FICHA DE REGISTRO DE VISITANTE</h2>
            <div className="mb-4">
              <h3 className="bg-purple-100 text-purple-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados do Visitante</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Nome Completo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Telefone:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Idade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Data da Visita:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Endereço:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-48">Como nos conheceu / Quem o convidou?</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              </div>
            </div>
            <div className="mb-8">
              <h3 className="bg-purple-100 text-purple-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Observações</h3>
              <div className="border border-gray-400 rounded h-24"></div>
            </div>
          </>
        )}

        {/* 5. FICHA DE CRIANÇA */}
        {tipo === "crianca" && (
          <>
            <h2 className="text-lg font-bold uppercase mb-4">FICHA DE CADASTRO INFANTIL</h2>
            <div className="mb-4">
              <h3 className="bg-pink-100 text-pink-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Dados da Criança</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-2 items-end"><span className="font-semibold w-24">Nome Completo:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Nascimento:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-16">Idade:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-24">Sala / Turma:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="bg-pink-100 text-pink-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Pais e Responsáveis</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Nome do Pai:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Telefone:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Nome da Mãe:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Telefone:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-56">Pessoas autorizadas a retirar a criança:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              </div>
            </div>
            <div className="mb-4">
              <h3 className="bg-pink-100 text-pink-900 font-bold text-xs uppercase px-2 py-1 mb-3 rounded">Ficha de Saúde e Alergias</h3>
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex gap-4">
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Alergias:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                  <div className="flex gap-2 items-end flex-1"><span className="font-semibold w-32">Medicamentos:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
                </div>
                <div className="flex gap-2 items-end"><span className="font-semibold w-40">Problemas de Saúde / Observações:</span><div className="flex-1 border-b border-gray-400 h-5"></div></div>
              </div>
            </div>
          </>
        )}

        <Rodape temAssinatura={tipo !== "crianca"} />
        
        {tipo === "crianca" && (
           <div className="flex justify-between mt-8">
            <div className="w-1/3 border-t border-black text-center pt-1 text-xs">Assinatura do Responsável</div>
          </div>
        )}

      </div>
    </div>
  );
}