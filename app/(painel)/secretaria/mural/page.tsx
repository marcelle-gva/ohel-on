"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Plus, Edit, Trash2, AlertTriangle, Calendar, Megaphone } from "lucide-react";

interface PostMural {
  id: string;
  tipo: 'comunicacao' | 'evento';
  titulo: string;
  conteudo: string;
  imagem_url: string | null;
  data_criacao: string;
}

export default function MuralPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostMural[]>([]);
  const [loading, setLoading] = useState(true);
  const [postToDelete, setPostToDelete] = useState<PostMural | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchMural();
  }, []);

  const fetchMural = async () => {
    try {
      setLoading(true);
      
      // Busca Comunicações
      const { data: coms } = await supabase.from('comunicacoes').select('*').order('created_at', { ascending: false });
      
      // Busca Eventos Publicados
      const { data: evs } = await supabase.from('eventos').select('*').eq('publicar_mural', true).order('created_at', { ascending: false });
      
      const formattedComs: PostMural[] = (coms || []).map(c => ({
        id: c.id,
        tipo: 'comunicacao',
        titulo: c.titulo,
        conteudo: c.conteudo,
        imagem_url: c.imagem_url,
        data_criacao: c.created_at
      }));
      
      const formattedEvs: PostMural[] = (evs || []).map(e => ({
        id: e.id,
        tipo: 'evento',
        titulo: e.nome,
        conteudo: e.descricao || "Confira os detalhes do nosso evento!",
        imagem_url: e.cartaz_url,
        data_criacao: e.created_at
      }));
      
      const all = [...formattedComs, ...formattedEvs].sort((a, b) => new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime());
      
      setPosts(all);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    try {
      const table = postToDelete.tipo === 'evento' ? 'eventos' : 'comunicacoes';
      await supabase.from(table).delete().eq('id', postToDelete.id);
      setPosts(posts.filter(p => p.id !== postToDelete.id || p.tipo !== postToDelete.tipo));
      setPostToDelete(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mural de Comunicações</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie os avisos e notícias da igreja.</p>
        </div>
        <Link href="/mural/novo" className="bg-ohel-blue hover:bg-blue-600 text-white font-medium py-2.5 px-6 rounded-md transition-all shadow-[0_0_15px_rgba(0,123,255,0.2)] flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Comunicação
        </Link>
      </div>

      {loading ? (
        <div className="text-center p-10 text-gray-400">Carregando mural...</div>
      ) : posts.length === 0 ? (
        <div className="text-center p-10 text-gray-400 bg-ohel-surface/30 rounded-xl border border-gray-800">Nenhuma publicação no mural ainda.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Card key={`${post.tipo}-${post.id}`} className="p-0 overflow-hidden border-gray-800 bg-ohel-surface flex flex-col hover:border-ohel-blue/50 transition-colors">
              
              <div className="h-48 w-full relative bg-gradient-to-br from-ohel-surface to-ohel-bg">
                {post.imagem_url ? (
                  <Image src={post.imagem_url} alt={post.titulo} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {post.tipo === 'evento' ? <Calendar className="w-12 h-12 text-gray-700" /> : <Megaphone className="w-12 h-12 text-gray-700" />}
                  </div>
                )}
                
                {post.tipo === 'evento' && (
                  <div className="absolute top-3 right-3 bg-purple-500/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <Megaphone className="w-3 h-3" /> Evento
                  </div>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-ohel-blue text-xs font-semibold mb-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatarData(post.data_criacao)}
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2">{post.titulo}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">{post.conteudo}</p>

                <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-end gap-4">
                  <button 
                    onClick={() => {
                      if (post.tipo === 'evento') router.push(`/eventos/editar/${post.id}`);
                      else router.push(`/mural/editar/${post.id}`);
                    }} 
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" /> EDITAR
                  </button>
                  <button 
                    onClick={() => setPostToDelete(post)} 
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> EXCLUIR
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {postToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-ohel-surface border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Excluir Publicação</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
              Tem certeza que deseja excluir <strong>{postToDelete.titulo}</strong>? Isso removerá a publicação do mural permanentemente.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setPostToDelete(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white" disabled={isDeleting}>Cancelar</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md text-sm flex items-center gap-2" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}