// Voto del cliente sobre una respuesta: reenvia a POST /api/v1/feedback del backend.
import { NextResponse } from "next/server";

import { ErrorBackend, llamarBackend } from "@/lib/backend";

const MOTIVOS = ["producto_no_adecuado", "muy_caro", "no_entendi", "no_era_lo_que_buscaba", "otro"];

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    mensaje_id?: string;
    valor?: string;
    motivo?: string;
  };
  if (!body.mensaje_id || (body.valor !== "positivo" && body.valor !== "negativo")) {
    return NextResponse.json({ error: "Voto invalido" }, { status: 400 });
  }
  const motivo = body.valor === "negativo" && body.motivo && MOTIVOS.includes(body.motivo) ? body.motivo : undefined;
  try {
    await llamarBackend("/api/v1/feedback", { mensaje_id: body.mensaje_id, valor: body.valor, motivo });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const status = e instanceof ErrorBackend ? e.status : 500;
    return NextResponse.json({ error: "No se pudo registrar el voto" }, { status });
  }
}
