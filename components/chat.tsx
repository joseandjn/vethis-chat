"use client";

// Chat del asesor con assistant-ui. El runtime local manda cada mensaje del cliente a
// /api/chat (servidor de Next.js), que lo reenvia al backend con el token de la sesion. El
// historial lo guarda el backend; aca solo se muestra.
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
  useLocalRuntime,
  type ChatModelAdapter,
  type FeedbackAdapter,
  type ThreadMessage,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { ArrowUp, PawPrint, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import remarkGfm from "remark-gfm";

const SUGERENCIAS = [
  "Tengo un perro adulto de 20 kg, ¿qué alimento me recomiendas?",
  "Busco alimento para un gato senior de 4 kg, hasta S/ 120",
  "¿Cuánto alimento debe comer al día un cachorro de 5 kg?",
];

const MOTIVOS: { valor: string; texto: string }[] = [
  { valor: "producto_no_adecuado", texto: "El producto no es adecuado" },
  { valor: "muy_caro", texto: "Muy caro" },
  { valor: "no_entendi", texto: "No entendí la respuesta" },
  { valor: "no_era_lo_que_buscaba", texto: "No era lo que buscaba" },
  { valor: "otro", texto: "Otro" },
];

function textoDe(message: ThreadMessage): string {
  return message.content
    .map((parte) => (parte.type === "text" ? parte.text : ""))
    .join("")
    .trim();
}

function mensajeIdDe(message: ThreadMessage): string | undefined {
  const custom = message.metadata.custom as { mensaje_id?: unknown };
  return typeof custom?.mensaje_id === "string" ? custom.mensaje_id : undefined;
}

async function enviarVoto(mensajeId: string, valor: "positivo" | "negativo", motivo?: string) {
  await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensaje_id: mensajeId, valor, motivo }),
  });
}

const asesor: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    const ultimo = messages[messages.length - 1];
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensaje: textoDe(ultimo) }),
      signal: abortSignal,
    });
    if (!r.ok) {
      const { error } = (await r.json().catch(() => ({}))) as { error?: string };
      throw new Error(error ?? "No se pudo obtener respuesta del asesor");
    }
    const { respuesta, mensaje_id } = (await r.json()) as { respuesta: string; mensaje_id: string };
    // El mensaje_id queda en la metadata del mensaje para poder votarlo despues.
    return { content: [{ type: "text", text: respuesta }], metadata: { custom: { mensaje_id } } };
  },
};

const feedback: FeedbackAdapter = {
  submit({ message, type }) {
    const id = mensajeIdDe(message);
    if (id) void enviarVoto(id, type === "positive" ? "positivo" : "negativo");
  },
};

function MarkdownText() {
  return <MarkdownTextPrimitive remarkPlugins={[remarkGfm]} className="md" />;
}

/** Despues de un 👎, ofrece elegir el motivo (opcional). Reenvia el voto con el motivo. */
function MotivoNegativo() {
  const negativo = useAuiState((s) => s.message.metadata.submittedFeedback?.type === "negative");
  const mensajeId = useAuiState((s) => {
    const custom = s.message.metadata.custom as { mensaje_id?: unknown };
    return typeof custom?.mensaje_id === "string" ? custom.mensaje_id : undefined;
  });
  const [elegido, setElegido] = useState<string | null>(null);

  if (!negativo || !mensajeId) return null;
  if (elegido) return <p className="mt-2 text-xs text-stone-500">Gracias, lo tendremos en cuenta.</p>;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-stone-500">¿Qué falló?</span>
      {MOTIVOS.map((m) => (
        <button
          key={m.valor}
          type="button"
          onClick={() => {
            setElegido(m.valor);
            void enviarVoto(mensajeId, "negativo", m.valor);
          }}
          className="rounded-full border border-stone-300 px-2.5 py-1 text-stone-700 hover:border-teal-600 hover:text-teal-700"
        >
          {m.texto}
        </button>
      ))}
    </div>
  );
}

function MensajeCliente() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-teal-700 px-4 py-2.5 text-white">
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
}

const botonVoto =
  "rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 data-[submitted=true]:text-teal-700";

function MensajeAsesor() {
  // Mientras el backend responde, el mensaje existe pero vacio: se muestra "escribiendo".
  const pensando = useAuiState((s) => s.message.status?.type === "running" && s.message.content.length === 0);
  return (
    <MessagePrimitive.Root className="flex gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <PawPrint size={16} />
      </div>
      {pensando ? (
        <span className="self-center animate-pulse text-sm text-stone-500">El asesor está escribiendo…</span>
      ) : (
        <div className="min-w-0 max-w-[85%]">
          <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-stone-800 shadow-sm ring-1 ring-stone-200">
            <MessagePrimitive.Parts components={{ Text: MarkdownText }} />
            <MessagePrimitive.Error>
              <p className="text-sm text-red-700">No pude responder. Intenta de nuevo en un momento.</p>
            </MessagePrimitive.Error>
          </div>
          <ActionBarPrimitive.Root hideWhenRunning className="mt-1 flex gap-1">
            <ActionBarPrimitive.FeedbackPositive className={botonVoto} aria-label="Buena respuesta">
              <ThumbsUp size={15} />
            </ActionBarPrimitive.FeedbackPositive>
            <ActionBarPrimitive.FeedbackNegative className={botonVoto} aria-label="Mala respuesta">
              <ThumbsDown size={15} />
            </ActionBarPrimitive.FeedbackNegative>
          </ActionBarPrimitive.Root>
          <MotivoNegativo />
        </div>
      )}
    </MessagePrimitive.Root>
  );
}

function Hilo() {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <ThreadPrimitive.Empty>
            <div className="mt-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <PawPrint size={24} />
              </div>
              <h2 className="text-xl font-semibold text-stone-800">¡Hola! Soy Vethis</h2>
              <p className="mt-1 text-stone-500">
                Te ayudo a elegir el alimento ideal para tu mascota.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                {SUGERENCIAS.map((s) => (
                  <ThreadPrimitive.Suggestion
                    key={s}
                    prompt={s}
                    send
                    className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-left text-sm text-stone-700 hover:border-teal-600"
                  >
                    {s}
                  </ThreadPrimitive.Suggestion>
                ))}
              </div>
            </div>
          </ThreadPrimitive.Empty>
          <ThreadPrimitive.Messages components={{ UserMessage: MensajeCliente, AssistantMessage: MensajeAsesor }} />
        </div>
      </ThreadPrimitive.Viewport>

      <div className="border-t border-stone-200 bg-white px-4 py-3">
        <ComposerPrimitive.Root className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-stone-300 bg-white px-3 py-2 focus-within:border-teal-600">
          <ComposerPrimitive.Input
            autoFocus
            rows={1}
            placeholder="Escribe tu consulta…"
            className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-stone-800 outline-none placeholder:text-stone-400"
          />
          <ComposerPrimitive.Send
            className="rounded-full bg-teal-700 p-2 text-white hover:bg-teal-800 disabled:opacity-40"
            aria-label="Enviar"
          >
            <ArrowUp size={18} />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
        <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-stone-400">
          Asistente virtual: no reemplaza la consulta con un veterinario.
        </p>
      </div>
    </ThreadPrimitive.Root>
  );
}

function ChatConRuntime() {
  const runtime = useLocalRuntime(asesor, { adapters: { feedback } });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Hilo />
    </AssistantRuntimeProvider>
  );
}

/** Cabecera con "nueva conversacion" e id de cliente opcional (para probar la memoria). */
export function Chat() {
  const [conversacion, setConversacion] = useState(0);
  const [cliente, setCliente] = useState("");
  const [clienteActivo, setClienteActivo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function nuevaConversacion() {
    setError(null);
    const r = await fetch("/api/sesion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente }),
    });
    if (!r.ok) {
      setError("No se pudo iniciar la conversación. ¿Está corriendo el backend?");
      return;
    }
    const { cliente: activo } = (await r.json()) as { cliente: string | null };
    setClienteActivo(activo);
    setConversacion((n) => n + 1); // remonta el runtime: hilo vacio
  }

  return (
    <div className="flex h-dvh flex-col bg-stone-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-stone-800">
          <PawPrint size={20} className="text-teal-700" /> Vethis · Asesor de alimentos
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="ID de cliente (opcional)"
            className="w-44 rounded-lg border border-stone-300 px-2.5 py-1.5 outline-none focus:border-teal-600"
          />
          <button
            type="button"
            onClick={nuevaConversacion}
            className="rounded-lg bg-stone-800 px-3 py-1.5 text-white hover:bg-stone-700"
          >
            Nueva conversación
          </button>
        </div>
        <p className="w-full text-xs text-stone-500">
          {clienteActivo
            ? `Conversando como cliente "${clienteActivo}": el asesor recuerda lo que le contaste en otras conversaciones.`
            : "Conversación anónima. Escribe un ID de cliente y empieza una nueva conversación para que el asesor te recuerde."}
          {error && <span className="ml-2 text-red-700">{error}</span>}
        </p>
      </header>
      <main className="min-h-0 flex-1">
        <ChatConRuntime key={conversacion} />
      </main>
    </div>
  );
}
