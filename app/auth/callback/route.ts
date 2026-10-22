import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    // Troca o código de autorização por uma sessão
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redireciona para o dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Se algo falhar, volta para o login
  return NextResponse.redirect(`${origin}/?error=oauth`)
}