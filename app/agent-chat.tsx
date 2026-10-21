"use client";

import { useEffect, useMemo, useRef } from "react";

export type ChatAction = {
  id: string;
  actionType: string;
  description: string;
  requiresConfirmation: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";
};

type Props = {
  level: "LOW" | "MEDIUM" | "HIGH";
  actions: ChatAction[];
  nextPending?: ChatAction;
  running: boolean;
  busy: boolean;
  onDecision: (action: ChatAction, decision: "approve" | "reject" | "execute") => void;
  onContinue: () => void;
  onStop: () => void;
  onQuestionnaire: () => void;
};

const levelGreeting = {
  LOW: "Revisei seu pedido. Vou sugerir uma mudança por vez e esperar sua aprovação antes de alterar a agenda.",
  MEDIUM: "Revisei seu pedido. Vou aplicar os ajustes rotineiros e pedir sua confirmação para resolver o conflito.",
  HIGH: "Revisei seu pedido. Vou aplicar o plano completo e mostrar cada atualização. Você pode interromper quando quiser.",
};

export function AgentChat({ level, actions, nextPending, running, busy, onDecision, onContinue, onStop, onQuestionnaire }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const visibleActions = useMemo(
    () => actions.filter((action) => action.status !== "PENDING" || action.id === nextPending?.id),
    [actions, nextPending],
  );
  const transcriptVersion = visibleActions.map((action) => `${action.id}:${action.status}`).join("|");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcriptVersion, running]);

  const resolved = actions.length > 0 && !nextPending;
  const rejectedCount = actions.filter((action) => action.status === "REJECTED").length;
  const progress = actions.length ? Math.round((actions.filter((action) => action.status !== "PENDING").length / actions.length) * 100) : 0;

  return (
    <section className="flex h-[min(760px,calc(100dvh-7rem))] min-h-[600px] flex-col overflow-hidden rounded-3xl border border-[#d9e3ed] bg-white shadow-[0_18px_55px_-30px_rgba(28,58,81,0.35)]">
      <header className="flex items-center justify-between border-b border-[#e8edf2] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1e5572] to-[#438f9c] text-lg text-white shadow-sm">
            <span aria-hidden="true">✦</span>
            <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div>
            <h2 className="font-semibold tracking-tight text-[#203947]">Assistente de IA</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#778894]"><span className="size-1.5 rounded-full bg-emerald-500" />Simulação experimental · disponível</p>
          </div>
        </div>
        <div className="rounded-full border border-[#d9e7ec] bg-[#f3f9fa] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#457989]">{level === "LOW" ? "Autonomia baixa" : level === "MEDIUM" ? "Autonomia média" : "Autonomia alta"}</div>
      </header>

      <div className="flex items-center gap-3 border-b border-[#edf1f4] px-5 py-3 sm:px-6">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#edf1f4]" role="progressbar" aria-label="Progresso da organização" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#357891] to-[#59aa9e] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-medium tabular-nums text-[#71818c]">{actions.filter((action) => action.status !== "PENDING").length} de {actions.length}</span>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#f4f9fa_0%,_#f8fafb_42%,_#f5f7f9_100%)] px-4 py-5 sm:px-6" role="log" aria-label="Conversa com o assistente" aria-live="polite">
        <div className="flex items-end gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e1eff1] text-sm text-[#3a7886]">✦</div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-[#e3eaee] bg-white px-4 py-3 text-sm leading-6 text-[#405461] shadow-sm">
            Oi! Vou ajudar você a organizar os compromissos de hoje. Pode me dizer o que precisa?
          </div>
        </div>

        <div className="ml-auto max-w-[88%]">
          <p className="mb-1.5 pr-1 text-right text-[11px] font-medium text-[#7a8994]">Você · mensagem enviada</p>
          <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-[#245d73] to-[#347f8a] px-4 py-3.5 text-sm leading-6 text-white shadow-[0_8px_20px_-12px_rgba(36,93,115,0.65)]">
            Organize minha agenda de hoje. Inclua um bloco de foco às 9h, mova o almoço para 13h e resolva o conflito entre a revisão de projeto e a ligação com cliente.
          </div>
        </div>

        <div className="flex items-end gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e1eff1] text-sm text-[#3a7886]">✦</div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-[#e3eaee] bg-white px-4 py-3 text-sm leading-6 text-[#405461] shadow-sm">
            {levelGreeting[level]}
          </div>
        </div>

        {visibleActions.map((action) => {
          const isWaiting = action.status === "PENDING" && action.requiresConfirmation;
          return (
            <div key={action.id} className="flex items-end gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e1eff1] text-sm text-[#3a7886]">✦</div>
              <article className={`max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3.5 shadow-sm ${isWaiting ? "border-[#d6e5ea] bg-white" : action.status === "REJECTED" ? "border-amber-200 bg-amber-50" : "border-[#e3eaee] bg-white"}`}>
                <p className="text-sm leading-6 text-[#344b58]">{action.description}</p>
                <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${action.status === "REJECTED" ? "text-amber-800" : action.status === "EXECUTED" ? "text-emerald-700" : "text-[#637e89]"}`}>
                  <span aria-hidden="true">{action.status === "EXECUTED" ? "✓" : action.status === "REJECTED" ? "↩" : isWaiting ? "◉" : "◌"}</span>
                  {action.status === "EXECUTED" ? "Atualizei sua agenda" : action.status === "REJECTED" ? "Não executei, conforme você pediu" : isWaiting ? "Preciso da sua aprovação para continuar" : "Vou realizar esta etapa automaticamente"}
                </p>
                {isWaiting && <div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf1f4] pt-3">
                  <button disabled={busy} onClick={() => onDecision(action, "approve")} className="rounded-xl bg-[#276a78] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1e5966] disabled:opacity-50">Sim, pode fazer</button>
                  <button disabled={busy} onClick={() => onDecision(action, "reject")} className="rounded-xl border border-[#d7e0e5] bg-white px-4 py-2 text-xs font-semibold text-[#526672] transition hover:bg-[#f5f8f9] disabled:opacity-50">Não, mantenha como está</button>
                </div>}
              </article>
            </div>
          );
        })}

        {running && <div className="flex items-end gap-2.5" role="status" aria-label="Assistente atualizando a agenda">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e1eff1] text-sm text-[#3a7886]">✦</div>
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[#e3eaee] bg-white px-4 py-3 shadow-sm"><span className="text-xs text-[#71818c]">Atualizando sua agenda</span><span className="ml-1 flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-[#5a96a0]" /><i className="size-1.5 animate-bounce rounded-full bg-[#5a96a0] [animation-delay:120ms]" /><i className="size-1.5 animate-bounce rounded-full bg-[#5a96a0] [animation-delay:240ms]" /></span></div>
        </div>}

        {resolved && !running && <div className="flex items-end gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e1eff1] text-sm text-[#3a7886]">✦</div>
          <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-[#dcebe4] bg-[#f5fbf7] px-4 py-3 text-sm leading-6 text-[#405b4c] shadow-sm">
            {rejectedCount ? "Pronto. Atualizei a agenda com as alterações aprovadas e mantive como estava o que você preferiu não alterar." : "Pronto! Sua agenda foi organizada. Você pode conferir os horários atualizados ao lado."}
          </div>
        </div>}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-[#e8edf2] bg-white px-4 py-4 sm:px-6">
        {running ? <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#71818c]">A execução pode ser interrompida; as atualizações já feitas permanecem visíveis.</p><button onClick={onStop} className="shrink-0 rounded-xl border border-[#d7e0e5] px-4 py-2.5 text-xs font-semibold text-[#526672] transition hover:bg-[#f5f8f9]">Interromper</button></div>
          : nextPending && !nextPending.requiresConfirmation ? <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#71818c]">A execução está pausada.</p><button disabled={busy} onClick={onContinue} className="rounded-xl bg-[#276a78] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1e5966] disabled:opacity-50">Retomar execução</button></div>
            : resolved ? <button onClick={onQuestionnaire} className="w-full rounded-xl bg-[#276a78] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1e5966]">Continuar para as perguntas <span aria-hidden="true">→</span></button>
              : <p className="flex items-center justify-center gap-2 py-1 text-xs text-[#80909a]"><span className="text-sm">🔒</span>Conversa vinculada à tarefa fictícia desta condição</p>}
      </footer>
    </section>
  );
}
