import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Atenção: As variáveis de ambiente do Supabase não estão configuradas.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // O callback do Google troca o parâmetro `code` por uma sessão.
    // O PKCE mantém essa troca vinculada ao navegador que iniciou o login.
    flowType: 'pkce',
    // A página /auth/callback troca o code manualmente. Deixar a detecção
    // automática ativa faria o Supabase tentar trocar o mesmo code duas vezes.
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});
