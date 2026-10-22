"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, CheckCircle2, XCircle, Calendar, Users, Save, UserX } from "lucide-react";

// INTERFACE PARA O TYPESCRIPT NÃO RECLAMAR
interface Aluno {
  membro_id: string;
  nome: string;
  presente: boolean;
}

export default function DiarioClassePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClasseId, setSelectedClasseId] = useState<string>("");
  const [dataAula, setDataAula] = useState(new Date().toISOString().split('T')[0]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    if (selectedClasseId && dataAula) {
      fetchAlunosEPresencas();
    }
  }, [selectedClasseId, dataAula]);

  const fetchClasses = async () => {
    setLoading(true);
    const { data } = await supabase.from('ebd_classes').select('*').eq('status', 'Ativa').order('nome');
    if (data) {
      setClasses(data);
      if (data.length > 0) setSelectedClasseId(data[0].id);
    }
    setLoading(false);
  };

  const fetchAlunosEPresencas = async () => {
    // 1. Busca todos os alunos matriculados na classe
    const { data: matriculas } = await supabase
      .from('ebd_matriculas')
      .select('membro_id, membros(nome)')
      .eq('classe_id', selectedClasseId)
      .eq('status', 'Ativo')
      .order('membros(nome)');

    if (!matriculas) return;

    // 2. Busca as presenças que já foram salvas para esta data
    const { data: presencas } = await supabase
      .from('ebd_presencas')
      .select('membro_id, presente')
      .eq('classe_id', selectedClasseId)
      .eq('data_aula', dataAula);

    // 3. Mescla os dados
    const listaFormatada: Aluno[] = matriculas.map(mat => {
      const registroPresenca = presencas?.find(p => p.membro_id === mat.membro_id);
      return {
        membro_id: mat.membro_id,
        nome: (mat.membros as any)?.nome || "Sem nome", // Tipagem forçada para o join
        presente: registroPresenca ? registroPresenca.presente : false
      };
    });

    setAlunos(listaFormatada);
  };

  const togglePresenca = (membro_id: string) => {
    setAlunos(alunos.map(aluno => 
      aluno.membro_id === membro_id ? { ...aluno, presente: !aluno.presente } : aluno
    ));
  };

  const marcarTodosPresentes = () => {
    setAlunos(alunos.map(aluno => ({ ...aluno, presente: true })));
  };

  const handleSalvarChamada = async () => {
    if (alunos.length === 0) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: user } = await supabase.from('usuarios').select('igreja_id').eq('id', session?.user.id).maybeSingle();

      if (!user) throw new Error("Igreja não identificada.");

      const registrosParaSalvar = alunos.map(aluno => ({
        igreja_id: user.igreja_id,
        classe_id: selectedClasseId,
        membro_id: aluno.membro_id,
        data_aula: dataAula,
        presente: aluno.presente
      }));

      // O Supabase faz o UPSERT usando a constraint UNIQUE (classe_id, membro_id, data_aula)
      const { error } = await supabase
        .from('ebd_presencas')
        .upsert(registrosParaSalvar, { onConflict: 'classe_id,membro_id,data_aula' });

      if (error) throw error;

      setModal({ isOpen: true, type: "success", title: "Sucesso", message: "Chamada salva com sucesso!" });
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const classeAtual = classes.find(c => c.id === selectedClasseId);
  const totalPresentes = alunos.filter(a => a.presente).length;
  const totalAusentes = alunos.length - totalPresentes;
  const taxaPresenca = alunos.length > 0 ? (totalPresentes / alunos.length) * 100 : 0;

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando diário de classe...</div>;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/ensino" className="text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-ohel-blue" /> Diário de Classe
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">Faça a chamada dos alunos da Escola Bíblica.</p>
          </div>
        </div>
      </div>

      <Card className="p-4 flex flex-col md:flex-row gap-4 items-center bg-ohel-surface border-gray-800">
        <div className="flex-1 w-full flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Classe</label>
          <select 
            value={selectedClasseId} 
            onChange={(e) => setSelectedClasseId(e.target.value)}
            className="input-ohel w-full px-3 py-2.5 rounded-md text-sm font-medium"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.faixa_etaria})</option>)}
          </select>
        </div>
        
        <div className="w-full md:w-48 flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-ohel-silver uppercase tracking-wider">Data da Aula</label>
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input 
              type="date" 
              value={dataAula}
              onChange={(e) => setDataAula(e.target.value)}
              className="input-ohel w-full pl-9 pr-3 py-2 rounded-md text-sm"
            />
          </div>
        </div>
      </Card>

      {classes.length === 0 ? (
        <Card className="p-10 text-center text-gray-400 text-sm">Nenhuma classe ativa cadastrada.</Card>
      ) : alunos.length === 0 ? (
        <Card className="p-10 flex flex-col items-center justify-center text-center">
          <UserX className="w-10 h-10 text-gray-600 mb-3" />
          <h3 className="text-sm font-bold text-white mb-1">Nenhum aluno matriculado</h3>
          <p className="text-gray-400 text-xs">Vá em "Matrículas" e adicione alunos a esta classe.</p>
        </Card>
      ) : (
        <>
          <div className="flex justify-between items-center bg-ohel-surface/50 border border-gray-800 p-4 rounded-xl">
            <div className="flex gap-6">
              <div>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Total</p>
                <p className="text-lg font-bold text-white">{alunos.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-green-500 uppercase font-bold">Presentes</p>
                <p className="text-lg font-bold text-green-500">{totalPresentes}</p>
              </div>
              <div>
                <p className="text-[10px] text-red-500 uppercase font-bold">Ausentes</p>
                <p className="text-lg font-bold text-red-500">{totalAusentes}</p>
              </div>
            </div>
            <Button onClick={marcarTodosPresentes} className="w-auto px-4 py-2 text-xs bg-ohel-surface border border-gray-700 hover:border-green-500 hover:text-green-500">
              Marcar Todos Presentes
            </Button>
          </div>

          <Card className="p-0 overflow-hidden border-gray-800">
            <div className="p-4 border-b border-gray-800 bg-ohel-surface/80 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-ohel-blue" /> Lista de Chamada - {classeAtual?.nome}
              </h3>
              <span className="text-xs text-gray-400">Presença: {taxaPresenca.toFixed(0)}%</span>
            </div>

            <div className="divide-y divide-gray-800/30">
              {alunos.map((aluno) => (
                <div key={aluno.membro_id} className="flex justify-between items-center p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${aluno.presente ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-500'}`}>
                      {aluno.nome.charAt(0)}
                    </div>
                    <p className="text-white font-medium">{aluno.nome}</p>
                  </div>
                  
                  <button 
                    onClick={() => togglePresenca(aluno.membro_id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors border ${aluno.presente ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'}`}
                  >
                    {aluno.presente ? <><CheckCircle2 className="w-4 h-4" /> Presente</> : <><XCircle className="w-4 h-4" /> Ausente</>}
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-800 bg-ohel-surface/50 flex justify-end">
              <Button onClick={handleSalvarChamada} disabled={saving} className="w-auto px-8 py-2.5 text-xs bg-ohel-blue hover:bg-blue-600 text-white shadow-lg">
                <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar Chamada"}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}