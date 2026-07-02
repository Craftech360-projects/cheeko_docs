---
id: config-deployment
sidebar_position: 4
---

# Config & Deployment

## Configuration

Config is loaded from `~/.picoclaw/config.json` (secrets in a companion `.security.yml`), with a `.env` file auto-loaded via godotenv. Environment variables use the `PICOCLAW_LIVEKIT_` prefix. The config struct is `LiveKitServiceConfig` in `pkg/config/config.go`.

| Setting / env var | Required | Purpose |
|---|---|---|
| `livekit_service.server_url` | Yes | LiveKit server WebSocket URL |
| API key / secret (security file) | Yes | LiveKit API credentials |
| `PICOCLAW_LIVEKIT_MANAGER_API_URL` | Yes | Manager API base, e.g. `http://127.0.0.1:8002/toy` (legacy alias `MANAGER_API_URL`) |
| `PICOCLAW_LIVEKIT_MANAGER_API_SERVICE_KEY` | Yes | Service key for Manager API (legacy alias `MANAGER_API_SECRET`) |
| `STT_DATABASE_URL` / `DIRECT_URL` | Yes | PostgreSQL holding `stt_providers` / `tts_providers` tables |
| `HealthPort` | No | `/health` + `/ready` HTTP port |
| `MaxSessions` | No | Concurrent session cap (default 100) |
| Runtime knobs | No | Greeting mode, async announce mode, VAD threshold / endpoint ms, language lock, turn timeout, rate-limit cooldowns, trace sampling |

Provider API keys (Deepgram, ElevenLabs, Anthropic, etc.) come from the security file / env, and active provider selection comes from the DB tables plus the Manager API (`GET /toy/livekit/providers/active`).

## Build

CGO is required (Opus, soxr, TEN VAD native lib):

```bash
# Windows
scripts/build-livekit.ps1

# Linux/macOS
make            # see Makefile; .goreleaser.yaml for releases
```

Run locally:

```bash
picoclaw-livekit --agent-name cheeko-agent --config ~/.picoclaw/config.json --log-level info
```

`--agent-name` is required — it is the name the MQTT gateway dispatches jobs to.

## Production: Kubernetes (EKS)

Production runs on **Kubernetes (EKS)** — see `HANDOVER_K8S_DEPLOYMENT.md` and `deploy/k8s/`:

| Manifest | Purpose |
|---|---|
| `livekit-deployment.yaml` | Worker Deployment (image from `Dockerfile.eks`) |
| `livekit-hpa.yaml` | Horizontal Pod Autoscaler |
| PDB | PodDisruptionBudget for safe node drains |
| PodMonitor | Prometheus scraping |
| cluster-autoscaler, network-policy, capacity test | Cluster-level supporting manifests |

`Dockerfile.eks` is a multi-stage CGO build that ships `libten_vad.so`, `workspace-template/`, and `prompts/cheeko.tmpl`; runs as uid 10001 and exposes port **8192** (health). Shutdown is graceful: SIGTERM drains active sessions before exit.

### Alternate deploy paths

| Path | Files | Use |
|---|---|---|
| Docker Compose | `deploy/docker-compose.livekit.yml` | Single-VM / staging (`--agent-name cheeko-agent1`) |
| Cerebrium | `Dockerfile.cerebrium` + `cerebrium.toml` | Legacy serverless option |

## Operational scripts

| Script | Purpose |
|---|---|
| `scripts/init_stt_db/`, `scripts/check_stt_db.go` | Seed / verify the STT provider tables |
| `scripts/stt_provider_manager/` | Manage active STT provider |
| `clean_livekit_workspace_memory.ps1` | Clear leftover per-device workspaces |
