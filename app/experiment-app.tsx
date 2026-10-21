"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentChat } from "@/app/agent-chat";

type Action = { id: string; actionType: string; description: string; requiresConfirmation: boolean; status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" };
type Session = { id: string; autonomyLevel: "LOW" | "MEDIUM" | "HIGH"; orderIndex: number; startedAt: string | null; status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED"; actions: Action[]; responses: { questionCode: string; likertValue: number | null; comment?: string | null }[] };
type State = { participantCode: string; runNumber: number; isTestRun: boolean; sessions: Session[] };
const statements = [
  ["control", "Senti que mantive o controle durante a tarefa."],
  ["understanding", "Entendi o que o agente estava fazendo."],
  ["trust", "Confiei nas ações realizadas pelo agente."],
  ["agency", "Pude influenciar o resultado da tarefa."],
  ["comfort", "Fiquei confortável com o nível de autonomia do agente."],
] as const;
const labels = { LOW: "Baixa autonomia", MEDIUM: "Média autonomia", HIGH: "Alta autonomia" };
const instructions = {
  LOW: "O assistente apresentará cada ação e aguardará sua aprovação antes de executá-la.",
  MEDIUM: "O assistente realizará ações rotineiras e pedirá sua confirmação para resolver o conflito da agenda.",
  HIGH: "O assistente realizará as ações planejadas e mostrará o progresso. Você pode interromper a sequência a qualquer momento.",
};

const baseAgenda = [
  { id: "standup", title: "Alinhamento da equipe", time: "08:30–09:00" },
  { id: "call", title: "Ligação com cliente", time: "10:30–11:30" },
  { id: "review", title: "Revisão de projeto", time: "10:00–11:00" },
  { id: "lunch", title: "Almoço", time: "12:00–13:00" },
];

export function ExperimentApp() {
  const [data, setData] = useState<State | null>(null);
  const [stage, setStage] = useState<"welcome" | "instructions" | "task" | "questionnaire" | "done">("welcome");
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const stopRef = useRef(false);
  const autoRunSessionRef = useRef<string | null>(null);
  const runAgentRef = useRef<() => Promise<void>>(async () => {});

  const refresh = useCallback(async () => {
    const response = await fetch("/api/experiment", { cache: "no-store" });
    if (!response.ok) return null;
    const state = await response.json() as State;
    setData(state);
    const next = state.sessions.find((session) => session.status === "IN_PROGRESS");
    if (!next) setStage("done");
    return state;
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/experiment", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const state = await response.json() as State;
      if (!active) return;
      setData(state);
      const currentSession = state.sessions.find((item) => item.status === "IN_PROGRESS");
      if (!currentSession) setStage("done");
    }).catch(() => {
      if (active) setError("Não foi possível recuperar a sessão salva. Atualize a página para tentar novamente.");
    });
    return () => { active = false; };
  }, []);
  const session = useMemo(() => data?.sessions.find((item) => item.status === "IN_PROGRESS"), [data]);
  const orderedActions = useMemo(() => {
    const order = ["add_appointment", "move_appointment", "resolve_conflict"];
    return session?.actions.slice().sort((a, b) => order.indexOf(a.actionType) - order.indexOf(b.actionType)) ?? [];
  }, [session]);
  const completedCount = orderedActions.filter((action) => action.status !== "PENDING").length;
  const nextPending = orderedActions.find((action) => action.status === "PENDING");
  const agenda = useMemo(() => {
    const events = baseAgenda.map((item) => ({ ...item }));
    for (const action of orderedActions.filter((item) => item.status === "EXECUTED")) {
      if (action.actionType === "add_appointment") events.push({ id: "focus", title: "Bloco de foco", time: "09:00–09:30" });
      if (action.actionType === "move_appointment") {
        const lunch = events.find((item) => item.id === "lunch");
        if (lunch) lunch.time = "13:00–14:00";
      }
      if (action.actionType === "resolve_conflict") {
        const review = events.find((item) => item.id === "review");
        if (review) review.time = "11:30–12:30";
      }
    }
    return events;
  }, [orderedActions]);

  async function startExperiment() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/experiment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível iniciar.");
      setData(result); setStage("instructions");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao iniciar. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function startNewTest() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/experiment/new-test", { method: "POST" });
      const result = await response.json().catch(() => null) as (State & { error?: string }) | null;
      if (!response.ok) throw new Error(result?.error ?? `Não foi possível iniciar um novo teste (HTTP ${response.status}).`);
      if (!result || !Array.isArray(result.sessions)) throw new Error("O servidor não retornou os dados do novo teste. Atualize a página e tente novamente.");
      setData(result);
      setAnswers({}); setComment("");
      setStage("instructions");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível iniciar um novo teste."); }
    finally { setBusy(false); }
  }

  async function withdraw() {
    if (!window.confirm("Deseja encerrar sua participação? As sessões ainda não concluídas serão registradas como abandonadas.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/experiment/withdraw", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível encerrar a participação.");
      setWithdrawn(true); setStage("done");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível encerrar a participação."); }
    finally { setBusy(false); }
  }

  async function beginSession() {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sessions/${session.id}/start`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível iniciar a tarefa.");
      await refresh();
      setStage("task");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a tarefa."); }
    finally { setBusy(false); }
  }

  async function decide(action: Action, decision: "approve" | "reject" | "execute") {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sessions/${session.id}/actions/${action.actionType}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "A ação não foi registrada.");
      setData((current) => current && ({ ...current, sessions: current.sessions.map((item) => item.id === session.id ? { ...item, actions: item.actions.map((row) => row.id === action.id ? { ...row, status: result.status } : row) } : item) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a ação."); }
    finally { setBusy(false); }
  }

  async function runAgent() {
    if (!session || running) return;
    stopRef.current = false; setRunning(true); setError("");
    try {
      for (const action of orderedActions.filter((item) => item.status === "PENDING")) {
        if (stopRef.current || (session.autonomyLevel === "MEDIUM" && action.requiresConfirmation)) break;
        const response = await fetch(`/api/sessions/${session.id}/actions/${action.actionType}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "execute" }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "A ação não foi concluída.");
        setData((current) => current && ({ ...current, sessions: current.sessions.map((item) => item.id === session.id ? { ...item, actions: item.actions.map((row) => row.id === action.id ? { ...row, status: result.status } : row) } : item) }));
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "O agente não conseguiu concluir a ação."); }
    finally { setRunning(false); }
  }
  useEffect(() => { runAgentRef.current = runAgent; });

  useEffect(() => {
    if (stage !== "task" || !session || (session.autonomyLevel !== "MEDIUM" && session.autonomyLevel !== "HIGH")) return;
    if (autoRunSessionRef.current !== session.id && orderedActions.some((action) => action.status === "PENDING" && !action.requiresConfirmation)) {
      autoRunSessionRef.current = session.id;
      void runAgentRef.current();
    }
  }, [stage, session, orderedActions]);

  async function submitQuestionnaire(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sessions/${session.id}/questionnaire`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: statements.map(([questionCode]) => ({ questionCode, likertValue: answers[questionCode] })), comment }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar as respostas.");
      const updated = await refresh();
      setAnswers({}); setComment("");
      setStage(updated?.sessions.some((item) => item.status === "IN_PROGRESS") ? "instructions" : "done");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar as respostas."); }
    finally { setBusy(false); }
  }

  const level = session?.autonomyLevel;
  return (
    <main className="min-h-screen bg-[#f5f7f5] px-4 py-8 text-[#20332f] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between border-b border-[#dbe4df] pb-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#527368]">Pesquisa acadêmica · IHC</p><p className="mt-1 text-sm text-[#52625d]">Experimento de organização de compromissos</p></div>
          {data && stage !== "done" && <div className="flex items-center gap-3"><span className="rounded-full border border-[#cad8d1] bg-white px-4 py-2 text-sm font-medium">{session ? `Condição ${session.orderIndex} de 3` : "Participação iniciada"}</span><button disabled={busy || running} onClick={() => void withdraw()} className="text-sm font-medium text-[#52625d] underline underline-offset-4 disabled:opacity-50">Encerrar participação</button></div>}
        </header>

        {stage === "welcome" && <section className="grid gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div className="py-5"><p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[#6c8d7e]">Interação e autonomia</p><h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Como você se sente ao dividir o controle com um agente?</h1><p className="mt-6 max-w-xl text-lg leading-8 text-[#52625d]">Você vai organizar uma agenda fictícia com um assistente experimental que apresenta diferentes níveis de autonomia. Após cada tarefa, responderá a algumas perguntas sobre sua experiência.</p><div className="mt-8 grid gap-3 sm:grid-cols-3">{["3 tarefas curtas", "5 perguntas após cada tarefa", "Compromissos fictícios"].map((item) => <div key={item} className="rounded-xl border border-[#dbe4df] bg-white p-4 text-sm font-medium">{item}</div>)}</div></div>
          <div className="rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm sm:p-8"><h2 className="text-xl font-semibold">Consentimento informado</h2><div className="mt-4 space-y-3 text-sm leading-6 text-[#52625d]"><p>Esta atividade acadêmica estuda como diferentes níveis de autonomia afetam a percepção de controle. A participação envolve três tarefas simuladas e questionários sobre sua experiência.</p><p>Serão registrados um código aleatório, a ordem e a duração das condições, as ações do agente e suas respostas. Não informe dados pessoais reais. O código não contém seu nome ou contato.</p><p>A participação é voluntária. Você pode desistir a qualquer momento pelo botão “Encerrar participação”; as sessões ainda em andamento serão registradas como abandonadas. As respostas serão utilizadas para análise acadêmica.</p><p>O assistente segue regras determinísticas e não é um modelo de inteligência artificial real. A pesquisadora deve confirmar com sua instituição ou orientação os procedimentos éticos aplicáveis antes da coleta.</p></div><label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-[#f4f7f5] p-4 text-sm leading-6"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 size-4 accent-[#315e4c]" /><span>Li as informações e concordo voluntariamente em participar.</span></label><button disabled={!consent || busy} onClick={startExperiment} className="mt-5 w-full rounded-xl bg-[#285744] px-5 py-3 font-semibold text-white hover:bg-[#204735] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Iniciando…" : "Concordar e iniciar"}</button></div>
        </section>}

        {stage === "instructions" && session && level && <section className="mx-auto max-w-3xl rounded-2xl border border-[#dbe4df] bg-white p-7 shadow-sm sm:p-10"><p className="text-sm font-semibold uppercase tracking-widest text-[#6c8d7e]">Etapa {session.orderIndex} de 3</p><h1 className="mt-3 text-3xl font-semibold">{labels[level]}</h1><p className="mt-4 text-lg leading-8 text-[#52625d]">{instructions[level]}</p><p className="mt-5 rounded-xl bg-[#f4f7f5] p-4 text-sm leading-6">A tarefa é sempre a mesma: incluir um bloco de foco, reorganizar o almoço e resolver um conflito entre dois compromissos. A agenda e os objetivos não mudam entre condições.</p><button disabled={busy} onClick={() => void beginSession()} className="mt-7 rounded-xl bg-[#285744] px-6 py-3 font-semibold text-white hover:bg-[#204735] disabled:opacity-50">{busy ? "Preparando tarefa…" : "Começar tarefa"}</button></section>}

        {stage === "task" && session && level && <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-[#6c8d7e]">Agenda fictícia</p><h1 className="mt-1 text-2xl font-semibold">Quarta-feira</h1></div><span className="rounded-full bg-[#edf4ef] px-3 py-1.5 text-xs font-semibold">{completedCount}/{orderedActions.length} ações</span></div><div className="mt-6 space-y-3">{agenda.sort((a, b) => a.time.localeCompare(b.time)).map((item) => <div key={item.id} className={`flex gap-4 rounded-xl border p-4 ${item.id === "call" || item.id === "review" ? "border-amber-200 bg-amber-50" : "border-[#e3e9e5] bg-[#fbfcfb]"}`}><span className="min-w-24 text-sm font-semibold text-[#527368]">{item.time}</span><span className="text-sm font-medium">{item.title}{(item.id === "call" || item.id === "review") && <small className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-amber-900">conflito inicial</small>}</span></div>)}</div><p className="mt-5 text-xs leading-5 text-[#71817b]">Os compromissos e horários são fictícios. As ações concluídas aparecem nesta agenda.</p></section>
          <AgentChat level={level} actions={orderedActions} nextPending={nextPending} running={running} busy={busy} onDecision={(action, decision) => void decide(action, decision)} onContinue={() => void runAgent()} onStop={() => { stopRef.current = true; }} onQuestionnaire={() => { setAnswers({}); setStage("questionnaire"); }} />
          <section className="hidden rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-[#6c8d7e]">Assistente experimental</p><h2 className="mt-1 text-xl font-semibold">Plano de organização</h2></div><span aria-label={running ? "Execução em andamento" : "Execução pausada"} className="rounded-full bg-[#f1f5f2] px-3 py-1.5 text-xs font-semibold">{running ? "Em andamento" : "Aguardando"}</span></div><ol className="mt-5 space-y-3">{orderedActions.map((action, index) => <li key={action.id} className="rounded-xl border border-[#e3e9e5] p-4"><div className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#edf4ef] text-xs font-bold">{index + 1}</span><div className="flex-1"><p className="text-sm font-medium leading-6">{action.description}</p><p className="mt-1 text-xs text-[#71817b]">{action.status === "EXECUTED" ? "Concluída" : action.status === "REJECTED" ? "Rejeitada" : action.status === "APPROVED" ? "Aprovada" : action.requiresConfirmation ? "Aguardando sua decisão" : "Ação planejada"}</p></div></div></li>)}</ol>
            <div aria-live="polite" className="mt-5 rounded-xl bg-[#f4f7f5] p-4 text-sm leading-6 text-[#52625d]">{nextPending ? (nextPending.requiresConfirmation ? "Esta ação precisa da sua decisão antes de continuar." : "O agente pode executar a próxima ação planejada.") : "Todas as ações foram resolvidas. Você pode responder ao questionário."}</div>
            {nextPending?.requiresConfirmation && !running && <div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void decide(nextPending, "approve")} className="rounded-xl bg-[#285744] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Aprovar ação</button><button disabled={busy} onClick={() => void decide(nextPending, "reject")} className="rounded-xl border border-[#cbd7d0] px-5 py-2.5 text-sm font-semibold hover:bg-[#f4f7f5] disabled:opacity-50">Rejeitar</button></div>}
            {nextPending && !nextPending.requiresConfirmation && !running && <button disabled={busy} onClick={() => void runAgent()} className="mt-4 rounded-xl bg-[#285744] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{level === "LOW" ? "Apresentar próxima ação" : "Executar plano"}</button>}
            {running && <button onClick={() => { stopRef.current = true; }} className="mt-4 rounded-xl border border-[#cbd7d0] px-5 py-2.5 text-sm font-semibold hover:bg-[#f4f7f5]">Interromper execução</button>}
            {!nextPending && <button onClick={() => { setAnswers({}); setStage("questionnaire"); }} className="mt-4 rounded-xl bg-[#285744] px-5 py-2.5 text-sm font-semibold text-white">Responder questionário</button>}
          </section>
        </div>}

        {stage === "questionnaire" && session && <section className="mx-auto max-w-3xl rounded-2xl border border-[#dbe4df] bg-white p-6 shadow-sm sm:p-9"><p className="text-sm font-semibold uppercase tracking-widest text-[#6c8d7e]">Condição {session.orderIndex} de 3</p><h1 className="mt-2 text-3xl font-semibold">Como foi sua experiência?</h1><p className="mt-3 text-sm leading-6 text-[#52625d]">Para cada afirmação, escolha um valor de 1 (discordo totalmente) a 5 (concordo totalmente).</p><form onSubmit={submitQuestionnaire} className="mt-7 space-y-5">{statements.map(([code, text]) => <fieldset key={code} className="rounded-xl border border-[#e3e9e5] p-4"><legend className="px-1 text-sm font-medium">{text}</legend><div className="mt-3 grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className={`cursor-pointer rounded-lg border p-2 text-center text-sm ${answers[code] === value ? "border-[#285744] bg-[#edf4ef] font-semibold" : "border-[#dbe4df]"}`}><input required type="radio" name={code} value={value} checked={answers[code] === value} onChange={() => setAnswers((current) => ({ ...current, [code]: value }))} className="sr-only" />{value}</label>)}</div><div className="mt-2 flex justify-between text-xs text-[#71817b]"><span>Discordo totalmente</span><span>Concordo totalmente</span></div></fieldset>)}<label className="block text-sm font-medium">Comentário opcional<textarea maxLength={1500} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#dbe4df] p-3 font-normal" /></label><button disabled={busy || Object.keys(answers).length !== statements.length} className="rounded-xl bg-[#285744] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Salvando…" : "Salvar e continuar"}</button></form></section>}

        {stage === "done" && <section className="mx-auto max-w-2xl rounded-2xl border border-[#dbe4df] bg-white p-8 text-center shadow-sm sm:p-12"><span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#edf4ef] text-2xl">✓</span><h1 className="mt-5 text-3xl font-semibold">{withdrawn ? "Participação encerrada" : "Participação concluída"}</h1><p className="mt-4 leading-7 text-[#52625d]">{withdrawn ? "As sessões que ainda estavam em andamento foram registradas como abandonadas. Obrigado pelo seu tempo." : "Obrigado por participar. Suas respostas foram registradas para análise acadêmica. Nenhum resultado individual de outros participantes é exibido aqui."}</p>{data && !withdrawn && <p className="mt-6 text-sm text-[#71817b]">Seu código anônimo: <strong className="font-mono text-[#20332f]">{data.participantCode}</strong></p>}</section>}

        {stage === "done" && data && !withdrawn && <section className="mx-auto mt-4 max-w-2xl text-center"><p className="text-xs text-[#71817b]">Execução {data.runNumber} · {data.isTestRun ? "teste de interface" : "participação oficial"}</p><button disabled={busy} onClick={() => void startNewTest()} className="mt-4 rounded-xl bg-[#285744] px-6 py-3 font-semibold text-white hover:bg-[#204735] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Preparando novo teste…" : "Iniciar novo teste"}</button><p className="mt-3 text-xs leading-5 text-[#71817b]">O novo teste mantém seu código anônimo e fica separado das respostas da participação oficial.</p></section>}

        {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
        <footer className="mt-12 border-t border-[#dbe4df] pt-5 text-xs leading-5 text-[#71817b]">Esta aplicação usa um assistente simulado com regras fixas; nenhuma IA externa é utilizada. Não insira informações pessoais reais.</footer>
      </div>
    </main>
  );
}
