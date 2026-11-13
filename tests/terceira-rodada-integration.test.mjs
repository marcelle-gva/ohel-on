import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const moduleUrl = (text) => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const transpile = (text) => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const regrasUrl = new URL("../lib/culto-lar.ts", import.meta.url).href;

async function loadServer() {
  let code = transpile(await readFile(new URL("../lib/culto-lar-server.ts", import.meta.url), "utf8"));
  code = code.replace(/import\s+["']server-only["'];?/g, "");
  code = code.replaceAll('"@/lib/culto-lar"', JSON.stringify(regrasUrl));
  code = code.replaceAll('"@/lib/access-server"', JSON.stringify(moduleUrl('export class AcessoError extends Error {} export const resolverAcesso=()=>{throw new Error("Não consultar serviços reais no teste");};')));
  return import(moduleUrl(code));
}

test("Meus envios filtra a conta autora além do membro e da igreja", async () => {
  const { listarCultoLar } = await loadServer();
  const rows = [
    { id: "antigo", igreja_id: "igreja", membro_id: "membro", autor_usuario_id: "conta-antiga", status: "Pendente" },
    { id: "proprio", igreja_id: "igreja", membro_id: "membro", autor_usuario_id: "conta-atual", status: "Rejeitado" },
    { id: "alheio", igreja_id: "outra-igreja", membro_id: "membro", autor_usuario_id: "conta-atual", status: "Pendente" },
  ];
  const filters = [];
  const service = { from() { let selected = rows; const q = { select() { return q; }, eq(field, value) { filters.push([field, value]); selected = selected.filter((row) => row[field] === value); return q; }, order() { return q; }, async range(start, end) { return { data: selected.slice(start, end + 1), count: selected.length, error: null }; } }; return q; } };
  const result = await listarCultoLar(service, "igreja", "meus", 0, 8, "membro", undefined, "conta-atual");
  assert.deepEqual(result.rows.map((row) => row.id), ["proprio"]);
  assert.deepEqual(filters, [["igreja_id", "igreja"], ["membro_id", "membro"], ["autor_usuario_id", "conta-atual"]]);
  const api = await readFile(new URL("../app/api/culto-lar/route.ts", import.meta.url), "utf8");
  assert.match(api, /listarCultoLar\([\s\S]*?acesso\.contexto\.usuarioId/);
});

test("editar data anual para outro ano mantém o formulário até salvar", async () => {
  const reactUrl = moduleUrl(`let values=[]; let cursor=0; export const reset=()=>{cursor=0;}; export const useMemo=(fn)=>fn(); export const useState=(initial)=>{const i=cursor++; if(!(i in values)) values[i]=typeof initial==='function'?initial():initial;return [values[i],value=>{values[i]=typeof value==='function'?value(values[i]):value;}];};`);
  const hooks = await import(reactUrl);
  let code = transpile(await readFile(new URL("../components/cultos/AgendaAnualCard.tsx", import.meta.url), "utf8"));
  const jsxUrl = moduleUrl('export const jsx=(type,props,key)=>({type,props,key}); export const jsxs=jsx; export const Fragment="fragment";');
  const iconsUrl = moduleUrl('export const CalendarDays="icon",Check="icon",Edit3="icon",Loader2="icon",X="icon";');
  code = code.replaceAll('"react"', JSON.stringify(reactUrl));
  code = code.replaceAll('"react/jsx-runtime"', JSON.stringify(jsxUrl));
  code = code.replaceAll('"lucide-react"', JSON.stringify(iconsUrl));
  for (const name of ["Card", "Button", "Input"]) code = code.replaceAll(`"@/components/ui/${name}"`, JSON.stringify(moduleUrl(`export const ${name}=${JSON.stringify(name.toLowerCase())};`)));
  code = code.replaceAll('"@/lib/programacao-cultos"', JSON.stringify(moduleUrl('export const anoAtualAgenda=()=>2026; export const dataAgendaLegivel=s=>s;')));
  const { AgendaAnualCard } = await import(moduleUrl(code));
  const changes = [], saves = [];
  const props = { programacoes: [{ id: "agenda", titulo: "Encontro", tipo: "Culto", data_culto: "2026-11-13", horario_inicio: "19:00", horario_fim: "21:00", observacoes: "", ativo: true }], tiposCulto: [{ id: "tipo", nome: "Culto", ativo: true }], anoSelecionado: "2026", podeGerir: true, saving: false, onCreate: async()=>{}, onToggle:async()=>{}, onAnoChange: (ano)=>{changes.push(ano);props.anoSelecionado=ano;props.programacoes=[];}, onEdit:async(id,form)=>{saves.push([id,form]);} };
  const render = ()=>{hooks.reset();return AgendaAnualCard(props);};
  function all(node) { if (Array.isArray(node)) return node.flatMap(all); if (!node || typeof node!=="object") return []; return [node,...all(node.props?.children)]; }
  const text = (node)=>typeof node==="string"?node:Array.isArray(node)?node.map(text).join(""):node?.props?text(node.props.children):"";
  let nodes=all(render());
  nodes.find((node)=>node.type==="button" && text(node).includes("Editar")).props.onClick();
  nodes=all(render());
  assert.equal(nodes.find((node)=>node.props?.["aria-label"]==="Filtrar agenda anual por ano").props.disabled,true);
  const editForm=nodes.filter((node)=>node.type==="form").at(-1);
  const date=all(editForm).find((node)=>node.props?.type==="date");
  date.props.onChange({target:{value:"2027-05-20"}});
  assert.deepEqual(changes,[]);
  nodes=all(render());
  const persistedForm=nodes.filter((node)=>node.type==="form").at(-1);
  assert.equal(all(persistedForm).find((node)=>node.props?.type==="date").props.value,"2027-05-20");
  await persistedForm.props.onSubmit({preventDefault(){}});
  assert.equal(saves[0][0],"agenda");
  assert.equal(saves[0][1].data_culto,"2027-05-20");
  assert.deepEqual(changes,["2027"]);
});
