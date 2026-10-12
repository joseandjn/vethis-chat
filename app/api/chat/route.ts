// Un turno del chat: reenvia el mensaje a POST /api/v2/chat con el Bearer de la sesion.
// El historial lo guarda el backend (por sesion), asi que solo se manda el mensaje nuevo.
import { NextResponse } from "next/server";

import { ErrorBackend, llamarBackend } from "@/lib/backend";

type ChatResponse = { respuesta: string; session_id: string; mensaje_id: string };

export async function POST(req: Request) {
  const { mensaje } = (await req.json().catch(() => ({}))) as { mensaje?: string };
  if (!mensaje?.trim()) {
    return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 });
  }
  try {
    const r = (await llamarBackend<ChatResponse>("/api/v2/chat", { mensaje }))!;
    return NextResponse.json({ respuesta: r.respuesta, mensaje_id: r.mensaje_id });
  } catch (e) {
    const status = e instanceof ErrorBackend ? e.status : 500;
    return NextResponse.json({ error: "No se pudo obtener respuesta del asesor" }, { status: status >= 500 ? 502 : status });
  }
}
