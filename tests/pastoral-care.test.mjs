import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Harness CommonJS isolado: não abre rede, autentica contas reais nem escreve em produção.
const root = path.resolve(import.meta.dirname, "..");
const IGREJA = "10000000-0000-0000-0000-000000000001";
const MEMBRO = "20000000-0000-0000-0000-000000000001";
const OUTRO = "20000000-0000-0000-0000-000000000002";
const ID = "30000000-0000-0000-0000-000000000001";
class AcessoError extends Error { constructor(message, status) { super(message); this.status = status; } }
function criarService(tabelas = {}) {
  const chamadas = [];
  return {
    chamadas,
    from(tabela) {
      const chamada = { tabela, filtros: [], operacao: "select" };
      chamadas.push(chamada);
      const query = {
        select(campos) { chamada.campos = campos; return query; },
        eq(campo, valor) { chamada.filtros.push([campo, valor]); return query; },
        gte(campo, valor) { chamada.corte = [campo, valor]; return query; },
        order() { return query; },
        range(inicio, fim) { chamada.range = [inicio, fim]; return query; },
        limit(n) { chamada.limit = n; return query; },
        insert(dados) { chamada.operacao = "insert"; chamada.dados = dados; return query; },
        update(dados) { chamada.operacao = "update"; chamada.dados = dados; return query; },
        single() { chamada.single = true; return query; },
        maybeSingle() { chamada.single = true; return query; },
        then(resolve) {
          if (tabelas.erro) return Promise.resolve({ data: null, error: { code: "DB_UNAVAILABLE", message: "SEGREDO SQL" } }).then(resolve);
          let rows = tabelas[tabela] || [];
          if (chamada.operacao === "insert") rows = [{ id: ID, created_at: "2026-11-13T12:00:00Z", ...chamada.dados }];
          else {
            rows = rows.filter(row => chamada.filtros.every(([k,v]) => row[k] === v));
            if (chamada.corte) rows = rows.filter(row => row[chamada.corte[0]] >= chamada.corte[1]);
            if (chamada.operacao === "update") rows.forEach(row => Object.assign(row, chamada.dados));
          }
          if (chamada.range) rows = rows.slice(chamada.range[0], chamada.range[1] + 1);
          if (chamada.limit) rows = rows.slice(0, chamada.limit);
          return Promise.resolve({ data: chamada.single ? rows[0] || null : rows, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}
function carregarHandlers({role="membro", permissoes=[], tabelas={}, negado} = {}) {
  const service = criarService(tabelas);
  const acessos = [];
  const contexto = { igrejaId: IGREJA, role, permissoes, membro: { id: MEMBRO } };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const moduloTeste = { exports: {} }; cache.set(filename, moduloTeste);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = spec => {
      if (spec === "server-only") return {};
      if (spec === "@/lib/access-server") return {
        AcessoError,
        resolverAcesso: async (_request, exigirMembro) => {
          acessos.push(exigirMembro);
          if (negado) throw new AcessoError("Acesso negado", negado);
          return { contexto, service };
        },
        respostaErroAcesso: error => Response.json({error:error instanceof AcessoError ? error.message : "Falha segura"}, {status:error.status || 500,headers:{"Cache-Control":"private, no-store"}}),
      };
      if (spec.startsWith("@/")) return load(path.join(root, spec.slice(2) + ".ts"));
      throw new Error(`Import não permitido no teste: ${spec}`);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, {filename})(localRequire,moduloTeste,moduloTeste.exports);
    return moduloTeste.exports;
  }
  return { h:load(path.join(root,"lib/pastoral-server.ts")), service, acessos };
}
function request(body, query="") {
  return new Request(`https://ohel.test/api${query}`, body === undefined ? {headers:{Authorization:"Bearer ficticio"}} : { method:"POST",headers:{Authorization:"Bearer ficticio","Content-Type":"application/json"},body:JSON.stringify(body) });
}
const agenda = (extras={}) => ({ id:ID, igreja_id:IGREJA, membro_id:MEMBRO, pastor_responsavel:"Pastor", data_atendimento:"2099-11-20",hora_atendimento:"14:00",tipo:"Aconselhamento",motivo:"Pedido do membro",status:"Agendado",created_at:"2026-11-13T12:00:00Z",observacoes:"NOTA SIGILOSA",...extras });
const form = () => ({tipo:"Aconselhamento",motivo:"Gostaria de conversar",data_atendimento:"2099-11-20",hora_atendimento:"14:00"});

test("histórico pessoal exige membro e restringe igreja/membro, sem observações sigilosas", async()=>{
  const {h,service,acessos}=carregarHandlers({tabelas:{atendimentos_pastorais:[agenda(),agenda({id:OUTRO,membro_id:OUTRO}),agenda({id:OUTRO,igreja_id:OUTRO})]}});
  const response=await h.carregarCuidadoMembro(request()); const body=await response.json();
  assert.equal(response.status,200); assert.deepEqual(acessos,[true]); assert.equal(body.atendimentos.length,1);
  assert.equal("observacoes" in body.atendimentos[0],false); assert.equal("igreja_id" in body.atendimentos[0],false);
  assert.equal(response.headers.get("cache-control"),"private, no-store");
  for(const c of service.chamadas) { assert.deepEqual(c.filtros,[["igreja_id",IGREJA],["membro_id",MEMBRO]]); assert.ok(!c.campos.includes("observacoes")); }
});
test("solicitação fixa identidade, igreja, status e responsável pendente no servidor",async()=>{
  const {h,service}=carregarHandlers(); const response=await h.solicitarAtendimento(request(form()));
  assert.equal(response.status,201); const row=service.chamadas[0].dados;
  assert.equal(row.igreja_id,IGREJA); assert.equal(row.membro_id,MEMBRO); assert.equal(row.status,"Agendado"); assert.equal(row.pastor_responsavel,"Aguardando confirmação"); assert.equal(row.observacoes,null);
});
test("membro não pode injetar identidade, status, pastor ou notas privadas",async()=>{
  for(const campo of ["igreja_id","membro_id","status","pastor_responsavel","observacoes"]) {
    const {h,service}=carregarHandlers(); const r=await h.solicitarAtendimento(request({...form(),[campo]:OUTRO}));
    assert.equal(r.status,400); assert.equal(service.chamadas.length,0);
  }
});
test("solicitação valida datas reais/futuras, hora, tipo e tamanho do motivo",async()=>{
  for(const change of [{data_atendimento:"2026-02-30"},{data_atendimento:"2000-01-01"},{hora_atendimento:"25:00"},{tipo:"Inexistente"},{motivo:""},{motivo:"x".repeat(2001)}]) {
    const {h,service}=carregarHandlers(); const r=await h.solicitarAtendimento(request({...form(),...change})); assert.equal(r.status,400); assert.equal(service.chamadas.length,0);
  }
});
test("cancelamento só atualiza o próprio atendimento Agendado atomicamente",async()=>{
  const row=agenda(); const {h,service}=carregarHandlers({tabelas:{atendimentos_pastorais:[row]}});
  const r=await h.cancelarAtendimento(request({acao:"cancelar"}),ID); assert.equal(r.status,200); assert.equal(row.status,"Cancelado");
  assert.deepEqual(service.chamadas[0].filtros,[["id",ID],["igreja_id",IGREJA],["membro_id",MEMBRO],["status","Agendado"]]);
  assert.equal((await r.json()).atendimento.observacoes,undefined);
});
test("não cancela outro membro, outra igreja ou atendimento encerrado",async()=>{
  for(const change of [{membro_id:OUTRO},{igreja_id:OUTRO},{status:"Realizado"},{status:"Cancelado"}]) {
    const row=agenda(change); const {h}=carregarHandlers({tabelas:{atendimentos_pastorais:[row]}});
    const r=await h.cancelarAtendimento(request({acao:"cancelar"}),ID); assert.equal(r.status,409); assert.deepEqual(row,agenda(change));
  }
});
test("registro emocional fixa identidade e rejeita valores arbitrários",async()=>{
  const {h,service}=carregarHandlers(); const r=await h.registrarEmocao(request({emoji:"Ansioso",observacao:"Preciso de acolhimento"})); assert.equal(r.status,201);
  assert.deepEqual(service.chamadas[0].dados,{igreja_id:IGREJA,membro_id:MEMBRO,emoji:"Ansioso",observacao:"Preciso de acolhimento"});
  for(const body of [{emoji:"inválido"},{emoji:"Feliz",observacao:"x".repeat(2001)},{emoji:"Feliz",membro_id:OUTRO}]) assert.equal((await h.registrarEmocao(request(body))).status,400);
});
test("membro básico não acessa os caminhos de equipe",async()=>{
  const {h,service}=carregarHandlers();
  for(const call of [()=>h.listarAtendimentosEquipe(request()),()=>h.opcoesAtendimento(request()),()=>h.criarAtendimentoEquipe(request(form())),()=>h.consultarAtendimentoEquipe(request(),ID),()=>h.editarAtendimentoEquipe(request(form()),ID),()=>h.listarEmocionalEquipe(request())]) assert.equal((await call()).status,403);
  assert.equal(service.chamadas.length,0);
});
test("permite leitura de equipe apenas com a ação ler e limita à própria igreja",async()=>{
  const {h,service}=carregarHandlers({permissoes:[{modulo:"gabinete",acao:"ler"}],tabelas:{atendimentos_pastorais:[agenda(),agenda({igreja_id:OUTRO})]}});
  const r=await h.listarAtendimentosEquipe(request());assert.equal(r.status,200);assert.equal((await r.json()).atendimentos.length,1);
  assert.deepEqual(service.chamadas[0].filtros,[["igreja_id",IGREJA]]); assert.equal((await h.consultarAtendimentoEquipe(request(),ID)).status,403);
});
test("edição exige permissão e o status anterior para não sobrescrever cancelamento concorrente",async()=>{
  const row=agenda({status:"Cancelado"}); const {h,service}=carregarHandlers({role:"admin",tabelas:{atendimentos_pastorais:[row]}});
  const body={...form(),pastor_responsavel:"Pastor",observacoes:"Privado",status:"Realizado",status_anterior:"Agendado"};
  const r=await h.editarAtendimentoEquipe(request(body),ID);assert.equal(r.status,409);assert.equal(row.status,"Cancelado");
  assert.ok(service.chamadas[0].filtros.some(([k,v])=>k==="status"&&v==="Agendado"));
});
test("atendimento terminal não pode reabrir e pendente não pode ser concluído sem pastor",async()=>{
  const {h,service}=carregarHandlers({role:"admin"});
  for(const change of [{status:"Agendado",status_anterior:"Realizado",pastor_responsavel:"Pastor"},{status:"Realizado",status_anterior:"Agendado",pastor_responsavel:"Aguardando confirmação"}]) {
    const r=await h.editarAtendimentoEquipe(request({...form(),...change}),ID);assert.ok([400,409].includes(r.status));
  }
  assert.equal(service.chamadas.length,0);
});
test("cadastro de equipe rejeita membro de outra igreja e preserva visitantes",async()=>{
  const {h}=carregarHandlers({role:"admin"});const base={...form(),pastor_responsavel:"Pastor",status:"Agendado"};
  assert.equal((await h.criarAtendimentoEquipe(request({...base,membro_id:OUTRO}))).status,400);
  assert.equal((await h.criarAtendimentoEquipe(request({...base,nome_visitante:"Maria"}))).status,201);
  assert.equal((await h.criarAtendimentoEquipe(request({...base,nome_visitante:"Maria",membro_id:MEMBRO}))).status,400);
});
test("cadastro da equipe não permite Realizado com responsável pendente",async()=>{
  const {h,service}=carregarHandlers({role:"admin"});
  const r=await h.criarAtendimentoEquipe(request({...form(),nome_visitante:"Maria",pastor_responsavel:"Aguardando confirmação",status:"Realizado"}));
  assert.equal(r.status,400);assert.equal(service.chamadas.length,0);
});
test("histórico pessoal paginado retorna todos os registros sem repetir ou cortar",async()=>{
  const rows=Array.from({length:205},(_,i)=>agenda({id:String(i)}));const {h}=carregarHandlers({tabelas:{atendimentos_pastorais:rows}});
  const result=[];for(let offset=0;;offset+=100){const r=await h.carregarCuidadoMembro(request(undefined,`?offset=${offset}`));const body=await r.json();result.push(...body.atendimentos);if(!body.hasMore)break;}
  assert.equal(result.length,205);assert.equal(new Set(result.map(r=>r.id)).size,205);
});
test("API retorna falhas seguras privadas, sem detalhes do banco",async()=>{
  const {h}=carregarHandlers({tabelas:{erro:true}});const r=await h.carregarCuidadoMembro(request());assert.equal(r.status,503);assert.ok(!JSON.stringify(await r.json()).includes("SEGREDO"));assert.equal(r.headers.get("cache-control"),"private, no-store");
});
test("sessão inválida ou membro inativo é rejeitado antes de tocar os dados",async()=>{
  for(const status of [401,403]) {const {h,service}=carregarHandlers({negado:status});assert.equal((await h.solicitarAtendimento(request(form()))).status,status);assert.equal(service.chamadas.length,0);}
});
test("parâmetros inválidos de id, período e paginação são rejeitados",async()=>{
  const {h}=carregarHandlers({role:"admin"});assert.equal((await h.consultarAtendimentoEquipe(request(),"não-uuid")).status,400);assert.equal((await h.listarEmocionalEquipe(request(undefined,"?periodo=abc"))).status,400);assert.equal((await h.listarAtendimentosEquipe(request(undefined,"?offset=-1"))).status,400);
});
