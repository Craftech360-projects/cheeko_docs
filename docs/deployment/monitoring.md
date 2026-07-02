---
id: monitoring
sidebar_position: 4
---

# Monitoring (Uptime Kuma)

Cheeko services are monitored with a self-hosted [Uptime Kuma](https://github.com/louislam/uptime-kuma) instance running as a Docker container on the production server. Source of truth: `README_UPTIME_KUMA.md` in the backend repo.

| Item | Value |
|---|---|
| Container name | `uptime-kuma` |
| UI | `http://127.0.0.1:3001` (server-local) |
| DB path (in container) | `/app/data/kuma.db` |
| Target addressing | Monitors use the system IP directly (not `host.docker.internal`) |

## Health endpoints monitored

### Manager API (`src/routes/index.js`)

| Endpoint | Checks |
|---|---|
| `GET /toy/health` | API liveness (env info, uptime) |
| `GET /toy/health/db` | Prisma → PostgreSQL connectivity. Returns DB state as JSON but always HTTP `200` — treat body, not status, as the signal |
| `GET /toy/health/deps/gemini` | Gemini reachability; needs `GEMINI_API_KEY` / `GOOGLE_API_KEY` |
| `GET /toy/health/deps/elevenlabs` | ElevenLabs via a tiny real TTS probe (works with TTS-only keys that lack `voices_read`); needs `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` |

Dependency endpoints return `503` when the key is missing or invalid. After changing `.env`, restart manager-api-node.

### MQTT Gateway

`GET :8004/health` — dedicated health server (`gateway/health-server.js`, port via `HEALTH_PORT`, default `8004`).

### Voice agent (picoclaw-livekit)

`GET :8192/health` and `/ready` (`pkg/health/server.go`). On Kubernetes these back the pod liveness/readiness probes; they are not currently in the Kuma inventory (candidates below).

## Monitor inventory

As configured in the live Kuma DB (2026-05-18):

| Name | Type | Target | Interval |
|---|---|---|---:|
| Manager API Health | http | `:8002/toy/health` | 30 s |
| Manager API DB Health | http | `:8002/toy/health/db` | 60 s |
| Manager Web Health | http | `:8001/health` | 60 s |
| MQTT Gateway Health | http | `:8004/health` | 30 s |
| EMQX MQTT Port | port | `:1883` | 30 s |
| LiveKit Local Port | port | `:7880` | 30 s |
| Manager API Remote Health | http | remote server `:8002/toy/health` | 60 s |
| LiveKit Cloud | port | `<project>.livekit.cloud:443` | 60 s |
| Qdrant Cloud | port | `<cluster>.cloud.qdrant.io:443` | 120 s |
| Mem0 API | port | `api.mem0.ai:443` | 120 s |
| Grafana Loki | port | `logs-prod-028.grafana.net:443` | 120 s |
| CloudFront CDN | port | `<distribution>.cloudfront.net:443` | 180 s |
| Uptime Kuma Self Check | http | `127.0.0.1:3001` | 60 s |
| Gemini API Health (via Manager API) | http | `:8002/toy/health/deps/gemini` | 1 h |
| Gemini API Port | port | `generativelanguage.googleapis.com:443` | 1 h |
| ElevenLabs API Health (via Manager API) | http | `:8002/toy/health/deps/elevenlabs` | 1 h |
| ElevenLabs API Port | port | `api.elevenlabs.io:443` | 120 s |

All monitors: retry interval 30 s, max 2 retries, timeouts 5–15 s. Dependency probes run hourly on purpose — each ElevenLabs check spends real TTS characters.

## Not yet monitored (candidates)

- Voice agent `:8192/health` / `/ready` (K8s probes exist, but no Kuma monitor)
- Gateway internal command server `GET :8091/health`
- Imagine server — no HTTP health endpoint (only `/ws`); a port check on `:8090` is the available option

## Quick verify

```powershell
curl.exe -i http://<server-ip>:8002/toy/health
curl.exe -i http://<server-ip>:8002/toy/health/db
curl.exe -i http://<server-ip>:8002/toy/health/deps/gemini
curl.exe -i http://<server-ip>:8002/toy/health/deps/elevenlabs
curl.exe -i http://<server-ip>:8004/health
```

:::note
Concrete server IPs and cloud hostnames live in `README_UPTIME_KUMA.md` in the backend repo — they are intentionally not reproduced here since this site may be publicly hosted.
:::
