# vethis-chat

Chat de demo del asesor de alimentos **Vethis**, sobre la API de
[`project-agent`](../project-agent). Hecho con **Next.js** (App Router) y
**[assistant-ui](https://www.assistant-ui.com)**, que trae los componentes de chat (hilo,
mensajes, input, markdown, botones de 👍/👎).

## Cómo funciona

```
Navegador (assistant-ui)
   │  /api/sesion, /api/chat, /api/feedback   (mismo origen, cookie httpOnly)
   ▼
Servidor de Next.js (app/api/*, lib/backend.ts)
   │  guarda la API key de la tienda; pide, renueva y guarda el JWT de la sesión
   ▼
project-agent: POST /api/v1/auth/token · /auth/refresh · /api/v2/chat · /api/v1/feedback
```

- **La API key nunca llega al navegador.** Solo la usa el servidor de Next.js
  (`lib/backend.ts`, marcado `server-only`). El navegador recibe una cookie `httpOnly` con el
  JWT de su sesión, que no puede leer desde JavaScript.
- **El historial lo guarda el backend** (por sesión, en Redis). El chat solo manda el
  mensaje nuevo en cada turno.
- **Token:** se crea al primer mensaje (sesión anónima) o con **Nueva conversación**. Si le
  quedan menos de 5 minutos, se renueva con `/auth/refresh`.
- **ID de cliente (opcional):** simula un cliente identificado por la tienda
  (`external_user_id`). Con eso se activa la memoria de largo plazo del backend.
- **Feedback:** cada respuesta del backend trae un `mensaje_id`, que queda en la metadata del
  mensaje. 👍/👎 lo envía a `/api/v1/feedback`. Después de un 👎 se puede elegir el motivo.

## Requisitos

- Node.js 20 o superior.
- `project-agent` corriendo (por ejemplo `docker compose up -d` en `../project-agent`, en el
  puerto 8000) y una API key de tienda (`python -m scripts.crear_tienda "Nombre"`).

## Correr en local

```bash
cp .env.example .env.local      # completar VETHIS_API_KEY
npm install
npm run dev                     # http://localhost:3000
```

Producción local: `npm run build && npm start`.

## Estructura

| Archivo | Para qué |
|---|---|
| `components/chat.tsx` | Interfaz: runtime de assistant-ui (`useLocalRuntime`) con adaptadores de chat y feedback, mensajes, motivos del 👎, cabecera |
| `app/api/sesion/route.ts` | Nueva sesión (anónima o con ID de cliente) / cerrar sesión |
| `app/api/chat/route.ts` | Reenvía el mensaje a `POST /api/v2/chat` |
| `app/api/feedback/route.ts` | Reenvía el voto a `POST /api/v1/feedback` |
| `lib/backend.ts` | Cliente del backend: API key, cookie del token, renovación |

## Versiones

Dependencias fijadas en versiones exactas: Next.js 16.3.6, React 19.3.0, assistant-ui
0.15.22, Tailwind CSS 4.3.3, TypeScript 5.9.3.

## Pendiente

- **Streaming** (`docs/streaming.md` en project-agent): assistant-ui ya lo soporta; hace falta
  el endpoint SSE en el backend.
- **Despliegue** junto al backend (por ejemplo, un contenedor más detrás de Caddy en la demo
  de Azure). `next.config.ts` ya genera la salida `standalone` para Docker.
- Widget embebible para los sitios de las tiendas.
