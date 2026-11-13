import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const ROOT = path.resolve(import.meta.dirname, '..');
function loadMonitor(rows, denied) {
  const calls=[];
  const service={from(table){
    const call={table,filters:[]}; calls.push(call);
    const q={select(){return q;},eq(k,v){call.filters.push([k,v]);return q;},gte(k,v){call.from=[k,v];return q;},lte(k,v){call.to=[k,v];return q;},order(){return q;},limit(){return q;},maybeSingle(){call.single=true;return q;},then(resolve){
      let data=table==='pedidos_oracao'?rows.filter(row=>call.filters.every(([k,v])=>row[k]===v)&&(!call.from||row[call.from[0]]>=call.from[1])&&(!call.to||row[call.to[0]]<=call.to[1])):[];
      return Promise.resolve(resolve({data:call.single?null:data,error:null,count:0}));
    }};return q;
  }};
  class AcessoError extends Error {constructor(message,status){super(message);this.status=status;}}
  const access={AcessoError,resolverAcesso:async()=>{if(denied)throw new AcessoError('Negado',denied);return {service,contexto:{igrejaId:'igreja-a'}};},respostaErroAcesso:error=>Response.json({error:error.message},{status:error.status||500})};
  function load(file){const exports={}; const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext(`(function(require,exports){${code}\n})`)(specifier=>{
    if(specifier==='@/lib/access-server')return access;
    if(specifier.startsWith('@/'))return load(path.join(ROOT,specifier.slice(2)+'.ts'));
    throw new Error('Import real proibido: '+specifier);
  },exports);return exports;}
  return {route:load(path.join(ROOT,'app/api/membros/monitor/route.ts')),calls};
}
test('Monitor legado entrega somente pública aprovada recente da própria igreja',async()=>{
  const base={id:'publica',igreja_id:'igreja-a',status:'Em Oração',visibilidade:'Público',created_at:new Date().toISOString(),descricao:'Fixture'};
  const {route,calls}=loadMonitor([base,{...base,id:'privada',visibilidade:'Privado'},{...base,id:'pendente',status:'Pendente'},{...base,id:'outra',igreja_id:'igreja-b'},{...base,id:'antiga',created_at:'2020-01-01T00:00:00Z'}]);
  const response=await route.GET(new Request('https://ohel.test/api/membros/monitor'));
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).monitor.oracoes.map(row=>row.id),['publica']);
  assert.deepEqual(calls.find(c=>c.table==='pedidos_oracao').filters,[['igreja_id','igreja-a'],['status','Em Oração'],['visibilidade','Público']]);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('Monitor rejeita acesso não autorizado sem consultar conteúdo',async()=>{
 const {route,calls}=loadMonitor([],403);
 assert.equal((await route.GET(new Request('https://ohel.test/api/membros/monitor'))).status,403);
 assert.equal(calls.length,0);
});
