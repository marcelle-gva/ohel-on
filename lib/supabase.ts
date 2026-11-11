import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Atenção: As variáveis de ambiente do Supabase não estão configuradas.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // O painel administrativo usa o retorno implícito do Supabase para não
    // depender de um code_verifier que pode ser perdido entre o Google e o
    // callback em alguns aliases/domínios da Vercel.
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
