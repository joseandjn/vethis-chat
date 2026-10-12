// Sesion del chat: crea una nueva (anonima o de un cliente) o la cierra. El token queda en
// una cookie httpOnly; el navegador nunca ve la API key ni el JWT.
import { NextResponse } from "next/server";

import { cerrarSesion, ErrorBackend, nuevaSesion } from "@/lib/backend";

export async function POST(req: Request) {
  const { cliente } = (await req.json().catch(() => ({}))) as { cliente?: string };
  const id = cliente?.trim().slice(0, 200) || undefined;
  try {
    const t = await nuevaSesion(id);
    return NextResponse.json({ session_id: t.session_id, cliente: id ?? null });
  } catch (e) {
    const status = e instanceof ErrorBackend ? 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export async function DELETE() {
  await cerrarSesion();
  return new NextResponse(null, { status: 204 });
}
