import { listarAtendimentosEquipe, criarAtendimentoEquipe } from "@/lib/pastoral-server";
export const runtime = "nodejs";
export const GET = listarAtendimentosEquipe;
export const POST = criarAtendimentoEquipe;
