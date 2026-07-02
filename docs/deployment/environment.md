---
id: environment
sidebar_position: 1
---

# Environment Variables

This page documents all environment variables for each Cheeko service. Copy the relevant sections into `.env` files in each service directory.

---

## manager-api-node

File: `main/manager-api-node/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8002` | HTTP server port |
| `NODE_ENV` | No | `development` | Runtime environment (`development` / `production`) |
| `CONTEXT_PATH` | No | `/toy` | URL context path prefix |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection pooler URL (pgbouncer/transaction mode, port 6543). **Sensitive.** |
| `DIRECT_URL` | **Yes** | — | Direct PostgreSQL URL for Prisma migrations (port 5432). **Sensitive.** |
| `SUPABASE_URL` | **Yes** | — | Supabase project URL — legacy; clients still instantiated but auth and queries run through Prisma. |
| `SUPABASE_ANON_KEY` | **Yes** | — | Supabase anon/public key. **Sensitive.** |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | — | Supabase service role key (bypasses RLS). **Sensitive — keep server-side only.** |
| `SERVICE_SECRET_KEY` | **Yes** | — | Shared secret for backend-to-backend calls (voice agent / MQTT gateway → manager-api). **Sensitive.** |
| `QDRANT_URL` | No | — | Qdrant Cloud cluster URL (e.g., `https://xxx.qdrant.io`) |
| `QDRANT_API_KEY` | No | — | Qdrant API key. **Sensitive.** |
| `QDRANT_COLLECTION_NAME` | No | `rfid_content` | Qdrant collection name for RFID RAG |
| `MEM0_API_KEY` | No | — | Mem0 memory/personalization API key. **Sensitive.** |
| `MQTT_GATEWAY_INTERNAL_URL` | No | `http://127.0.0.1:8091` | Gateway internal HTTP API for settings push |
| `FIREBASE_PROJECT_ID` | **Yes** | — | Firebase project for mobile-app auth |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | **Yes** | — | Path to the Firebase admin SDK JSON. **Sensitive.** |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | No | — | Gemini health-check endpoint. **Sensitive.** |
| `ELEVENLABS_API_KEY` / `ELEVEN_API_KEY` | No | — | ElevenLabs health-check endpoint. **Sensitive.** |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | No | — | S3 access for content + imagine uploads. **Sensitive.** |
| `S3_BUCKET_NAME` / `S3_ENDPOINT` | No | — | S3 bucket (set `S3_ENDPOINT` for MinIO, enables path-style) |
| `CLOUDFRONT_DOMAIN` / `USE_CDN` / `IMAGINE_PUBLIC_BASE` | No | — | CDN base for content and generated-image URLs |
| `LIVEKIT_URL` | No | — | LiveKit server URL exposed via `/toy/admin/server` config |
| `LIVEKIT_DEFAULT_AGENT` | No | `cheeko-agent` | Default runtime agent name |
| `ADMIN_PASSWORD` | No | — | Gate for the `/admin-dashboard` persona editor. **Sensitive.** |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | No | — | Daily email reports. **Sensitive.** |
| `CORS_ORIGINS` | No | `http://localhost:8080,http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limit window in milliseconds (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `5000` (code); `.env.example` sets `100` | Max requests per window |
| `LOG_LEVEL` | No | `debug` | Winston log level (`error`, `warn`, `info`, `http`, `debug`) |
| `JWT_SECRET` | No | — | JWT secret if not using Supabase default. **Sensitive.** |
| `JWT_EXPIRES_IN` | No | `7d` | JWT token expiry duration |

> The primary database is managed PostgreSQL (DigitalOcean; some environments still point `DATABASE_URL` at a Supabase pooler), accessed via Prisma. Supabase clients will be removed in a future cleanup.

---

## mqtt-gateway

File: `main/mqtt-gateway/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `LIVEKIT_URL` | No | (from `mqtt.json`) | LiveKit server WebSocket URL — env overrides `config/mqtt.json` |
| `LIVEKIT_API_KEY` | No | (from `mqtt.json`) | LiveKit API key. **Sensitive.** |
| `LIVEKIT_API_SECRET` | No | (from `mqtt.json`) | LiveKit API secret. **Sensitive.** |
| `MANAGER_API_URL` | **Yes** | — | URL of the manager-api-node service (e.g., `http://127.0.0.1:8002/toy`) |
| `MANAGER_API_SECRET` | **Yes** | — | Sent as `X-Service-Key` on internal calls to manager-api. **Sensitive.** |
| `CEREBRIUM_API_TOKEN` | **Yes** | — | Cerebrium platform token for music/story media API. **Sensitive.** Required at startup — process exits if missing. |
| `MEDIA_API_BASE` | No | `https://api.aws.us-east-1.cerebrium.ai/v4/p-89052e36/livekit-server-simple` | Media API base URL |
| `UDP_PORT` | No | `1883` (code) / `8884` (`.env.example`) | UDP server port for ESP32 device connections |
| `PUBLIC_IP` | No | `127.0.0.1` | Public IP address reported to connecting devices |
| `EMQX_HOST` | No | — | EMQX MQTT broker host (overrides config file value) |
| `EMQX_PORT` | No | — | EMQX MQTT broker port |
| `EMQX_PROTOCOL` | No | — | EMQX connection protocol (e.g., `mqtt`, `mqtts`) |
| `MQTT_GATEWAY_INTERNAL_HOST` / `MQTT_GATEWAY_INTERNAL_PORT` | No | `127.0.0.1` / `8091` | Internal command server (settings push from manager-api) |
| `HEALTH_HOST` / `HEALTH_PORT` | No | `0.0.0.0` / `8004` | Health HTTP server |
| `LIVEKIT_DEFAULT_AGENT` | No | `cheeko-agent` | Voice agent name dispatched by default |
| `LINE_ART_WS_URL` | No | `ws://127.0.0.1:8090/ws` | Imagine server WebSocket URL |
| `IMAGINE_TIMEOUT_MS` | No | `90000` | AI Imagine generation timeout |
| `MEM0_API_KEY` / `MEM0_API_URL` | No | — | Mem0 memory service. **Sensitive.** |
| `MQTT_SIGNATURE_KEY` | No | — | MQTT credential signature key. **Sensitive.** |
| `SENDER_ROUTE_TTL_MS` | No | 24 h | TTL for sender client-id routes |
| `LOKI_HOST` | No | — | Grafana Loki host URL for centralized logging (e.g., `https://logs-prod.grafana.net`) |
| `LOKI_USER` | No | — | Loki basic auth username. **Sensitive.** |
| `LOKI_PASSWORD` | No | — | Loki basic auth password/token. **Sensitive.** |
| `CAPTURE_CONSOLE_LOGS` | No | — | Set to `true` to forward `console.log` output to Loki |
| `ANALYTICS_AUDIT_LOG_ENABLED` / `_PATH` / `_INCLUDE_PAYLOAD` | No | `false` | Analytics audit log |
| `LOG_LEVEL` | No | `info` | Winston log level |

> MQTT broker connection details (host, port, credentials, topics) are also configurable via `main/mqtt-gateway/config/mqtt.json` which the ConfigManager watches for live-reload.

---

## Voice Agent (picoclaw-livekit)

Config lives in `~/.picoclaw/config.json` (secrets in `.security.yml`); a `.env` file is auto-loaded. Env prefix: `PICOCLAW_LIVEKIT_`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PICOCLAW_LIVEKIT_MANAGER_API_URL` | **Yes** | — | Manager API base URL (e.g., `http://127.0.0.1:8002/toy`). Legacy alias `MANAGER_API_URL`. |
| `PICOCLAW_LIVEKIT_MANAGER_API_SERVICE_KEY` | **Yes** | — | Service key for Manager API. **Sensitive.** Legacy alias `MANAGER_API_SECRET`. |
| `STT_DATABASE_URL` / `DIRECT_URL` | **Yes** | — | PostgreSQL holding `stt_providers` / `tts_providers` tables. **Sensitive.** |
| LiveKit `server_url` + API key/secret | **Yes** | — | Set in `config.json` / `.security.yml`. **Sensitive.** |
| Provider keys (`DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, ...) | Per provider | — | STT/TTS/LLM provider credentials. **Sensitive.** |
| `PICOCLAW_HOME` / `PICOCLAW_CONFIG` | No | `~/.picoclaw` | Config location overrides |
| Runtime knobs | No | — | Greeting mode, VAD threshold / endpoint ms, language lock, turn timeout, `MaxSessions` (100), `HealthPort` |

See [Voice Agent — Config & Deployment](../backend/voice-agent/config-deployment.md) for the full reference. The old Python `main/livekit-server/.env` variables (`GROQ_*`, `FUNASR_*`, `EDGE_TTS_*`, `GEMINI_REALTIME_*`, `VAD_*`, per-worker ports) no longer apply.

---

## Imagine Server (line_art)

File: `line_art/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `STT_BACKEND` | No | `groq` | `groq` (cloud Whisper) or `local` (Speaches) |
| `IMAGE_BACKEND` | No | `hf` | `hf` (HuggingFace FLUX.1-schnell) or `comfyui` (local GPU) |
| `MODERATION_BACKEND` | No | `groq` | `groq` LLM classifier or `off` |
| `GROQ_API_KEY` | Yes* | — | STT + moderation. **Sensitive.** |
| `HF_API_TOKEN` / `HF_MODEL_URL` | Yes* | — | HuggingFace inference. **Sensitive.** |
| `SPEACHES_BASE_URL` / `SPEACHES_MODEL` | No | `:8001` | Local STT backend |
| `COMFYUI_BASE_URL` / `COMFYUI_TIMEOUT_S` | No | `:8188` / `20` | Local image backend |
| `MONO_THRESHOLD` | No | `190` | Printer 1-bit threshold |
| `IMAGINE_FALLBACK_IMAGE` | No | `fallback.jpg` | Served on generation failure |
| `SAVE_DEVICE_AUDIO` / `SAVE_INPUT_AUDIO` | No | off | Debug WAV dumps |

*Required for the default cloud backends.

---

## manager-web

File: `main/manager-web/.env.local`

| Variable | Required | Default | Description |
|---|---|---|---|
| `VUE_APP_API_BASE_URL` | No | — | Backend API base URL (e.g., `http://localhost:8002/toy`). If unset, relative URLs are used. |
| `VUE_APP_PUBLIC_PATH` | No | `/` | Vue Router base path (useful when deployed to a subdirectory) |
| `VUE_APP_USE_CDN` | No | `false` | Set to `true` to load assets from CDN |
