"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FeedbackModal } from "@/components/ui/FeedbackModal";
import { ArrowLeft, ShieldCheck, Smartphone, Loader2, CheckCircle } from "lucide-react";
import QRCode from "react-qr-code";

export default function SegurancaPage() {
  const router = useRouter();
  
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  
  const [modal, setModal] = useState({ isOpen: false, type: "success" as "success" | "error", title: "", message: "" });

  useEffect(() => {
    fetchFactors();
  }, []);

  const fetchFactors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      setFactors(data?.totp || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'App Autenticador OHEL ON' });
      if (error) throw error;
      
      setEnrollData({
        factorId: data.id,
        uri: data.totp.uri,
        secret: data.totp.secret
      });
      setIsEnrolling(true);
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Erro", message: error.message });
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData) return;
    
    setVerifying(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: code
      });
      
      if (verifyError) throw verifyError;

      setModal({ isOpen: true, type: "success", title: "2FA Ativado!", message: "Sua conta agora está protegida com verificação em duas etapas." });
      setIsEnrolling(false);
      setEnrollData(null);
      setCode("");
      fetchFactors();
    } catch (error: any) {
      setModal({ isOpen: true, type: "error", title: "Código Incorreto", message: "Verifique o código no aplicativo e tente novamente." });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-400">Carregando segurança...</div>;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-10">
      <FeedbackModal isOpen={modal.isOpen} onClose={() => setModal({ ...modal, isOpen: false })} type={modal.type} title={modal.title} message={modal.message} />

      <div className="flex items-center gap-4">
        <Link href="/configuracoes" className="text-gray-400 hover:text-white transition-colors mt-1">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Segurança da Conta</h1>
          <p className="text-gray-400 text-sm mt-1">Proteja seu acesso com verificação em duas etapas (2FA).</p>
        </div>
      </div>

      <Card className="p-8 border-gray-800">
        <div className="flex items-start justify-between border-b border-gray-800 pb-6 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-ohel-blue" /> Autenticação em Duas Etapas (2FA)
            </h3>
            <p className="text-sm text-gray-400 mt-2 max-w-lg">
              Adiciona uma camada extra de segurança. Após inserir sua senha, será solicitado um código gerado pelo seu celular.
            </p>
          </div>
          {factors.length > 0 && !isEnrolling && (
            <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Ativado
            </span>
          )}
        </div>

        {factors.length === 0 && !isEnrolling && (
          <Button variant="primary" onClick={handleEnroll} className="w-auto px-6">
            <Smartphone className="w-4 h-4 mr-2" /> Configurar 2FA agora
          </Button>
        )}

        {isEnrolling && enrollData && (
          <div className="flex flex-col md:flex-row gap-8 items-center animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-4 rounded-xl shadow-lg">
              <QRCode value={enrollData.uri} size={180} />
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              <p className="text-sm text-gray-300">
                1. Abra seu aplicativo (Google Authenticator, Authy, etc).
                <br />
                2. Escaneie o QR Code ao lado.
              </p>
              <p className="text-sm text-gray-300">
                3. Se não puder escanear, use o código abaixo:
                <br />
                <strong className="text-white select-all tracking-widest font-mono mt-1 block bg-ohel-bg p-2 rounded border border-gray-700">{enrollData.secret}</strong>
              </p>

              <form onSubmit={handleVerify} className="flex flex-col gap-3 mt-2">
                <Input 
                  label="Código de 6 dígitos *" 
                  placeholder="000 000" 
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                  className="tracking-[0.3em] font-bold text-center text-lg"
                />
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="secondary" onClick={() => setIsEnrolling(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={verifying || code.length < 6}>
                    {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Confirmar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {factors.length > 0 && !isEnrolling && (
          <div className="bg-ohel-bg border border-gray-800 p-4 rounded-xl text-sm text-gray-400">
            Sua conta está devidamente protegida. Toda vez que você fizer login em um novo dispositivo, será necessário inserir o código de 6 dígitos do seu celular.
          </div>
        )}
      </Card>
    </div>
  );
}