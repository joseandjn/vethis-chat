// Cliente del backend project-agent. SOLO servidor: usa la API key de la tienda, que nunca
// llega al navegador. El navegador solo ve una cookie httpOnly con el JWT de su sesion.
import "server-only";

import { cookies } from "next/headers";

const COOKIE = "vethis_token";
// Se renueva el token si le quedan menos de 5 minutos.
const MARGEN_REFRESCO_S = 300;

function config() {
  const url = process.env.BACKEND_URL;
  const apiKey = process.env.VETHIS_API_KEY;
  if (!url || !apiKey) {
    throw new Error("Faltan BACKEND_URL o VETHIS_API_KEY en .env.local (ver .env.example)");
  }
  return { url: url.replace(/\/$/, ""), apiKey };
}

export class ErrorBackend extends Error {
  constructor(
    public status: number,
    detalle: string,
  ) {
    super(detalle);
  }
}

type TokenResponse = { access_token: string; expires_in: number; session_id: string };

/** Segundos que le quedan al JWT (sin verificar la firma: eso lo hace el backend). */
function segundosRestantes(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload.exp - Date.now() / 1000;
  } catch {
    return 0;
  }
}

async function guardarToken(t: TokenResponse) {
  (await cookies()).set(COOKIE, t.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: t.expires_in,
  });
}

/** Sesion nueva: anonima, o de un cliente si se pasa su id en la tienda (activa la memoria). */
export async function nuevaSesion(externalUserId?: string): Promise<TokenResponse> {
  const { url, apiKey } = config();
  const r = await fetch(`${url}/api/v1/auth/token`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(externalUserId ? { external_user_id: externalUserId } : {}),
    cache: "no-store",
  });
  if (!r.ok) throw new ErrorBackend(r.status, `No se pudo iniciar la sesion (${r.status})`);
  const t = (await r.json()) as TokenResponse;
  await guardarToken(t);
  return t;
}

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

/** Token vigente de la sesion: lo crea (anonimo) si no hay, y lo renueva si esta por vencer. */
async function tokenVigente(): Promise<string> {
  const actual = (await cookies()).get(COOKIE)?.value;
  if (!actual || segundosRestantes(actual) <= 0) {
    return (await nuevaSesion()).access_token;
  }
  if (segundosRestantes(actual) < MARGEN_REFRESCO_S) {
    const { url } = config();
    const r = await fetch(`${url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${actual}` },
      cache: "no-store",
    });
    if (r.ok) {
      const t = (await r.json()) as TokenResponse;
      await guardarToken(t);
      return t.access_token;
    }
  }
  return actual;
}

/** POST al backend con el Bearer de la sesion. */
export async function llamarBackend<T>(ruta: string, body: unknown): Promise<T | null> {
  const { url } = config();
  const r = await fetch(`${url}${ruta}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await tokenVigente()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => "");
    throw new ErrorBackend(r.status, detalle || `Error del backend (${r.status})`);
  }
  return r.status === 204 ? null : ((await r.json()) as T);
}
