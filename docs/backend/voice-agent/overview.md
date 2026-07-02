---
id: overview
sidebar_position: 1
---

# Voice Agent Overview (Go · picoclaw)

The Cheeko voice agent is a **Go LiveKit agent worker** built on a fork of [sipeed/picoclaw](https://github.com/sipeed/picoclaw), an ultra-lightweight Go AI agent framework. It replaces the previous Python `livekit-server` workers: instead of one Python process per game character, a single Go binary (`picoclaw-livekit`) serves all characters by pulling **personas** from the Manager API database per session.

**Repository:** [Craftech360-projects/picoclaw-chat](https://github.com/Craftech360-projects/picoclaw-chat) (Go module `github.com/sipeed/picoclaw`, Go 1.25). The voice binary is built from `cmd/picoclaw-livekit/` and is distinct from the generic picoclaw CLI and chat channels also present in the repo.

## What changed vs the Python livekit-server

| | Python livekit-server (legacy) | Go picoclaw-livekit (current) |
|---|---|---|
| Process model | One worker per character (`cheeko_worker.py`, `math_tutor_worker.py`, ...) | One worker binary; characters are DB-driven personas |
| Character switch | Gateway dispatches a different agent process | Same agent, different persona (`system_prompt` / `soul`) pulled from Manager API |
| STT/LLM/TTS | Gemini Realtime (native audio) + plugins | Explicit pipeline: TEN VAD → STT provider → LLM → TTS provider, each swappable at runtime |
| Tools | Python function tools in `src/features/` | Ported picoclaw tool system with a voice allowlist (filesystem, cron, MCP, spawn, search, send_file) |
| Deployment | PM2 / Cerebrium | Kubernetes (EKS) with HPA |

## Repository layout

| Package | Purpose |
|---|---|
| `cmd/picoclaw-livekit/` | Entry point (`main.go`) + per-session bootstrap: workspace lifecycle, Manager API integration, TTS/provider selection |
| `pkg/livekit/` | Core LiveKit integration: worker dispatch, `RoomSession` (WebRTC), `AudioPipeline`, `AgentBridge`, language policy, post-session persistence |
| `pkg/voice/` | STT/TTS/VAD providers: `stt/` (DB-driven factory), `tts/` + provider packages, `vad/` (TEN VAD via cgo), `deepgram/` streaming STT |
| `pkg/agent/` | Ported picoclaw agent core: tool loop, memory, context budget, MCP loop, hooks |
| `pkg/providers/` | LLM providers: Anthropic, OpenAI-compatible, Gemini, Azure, Bedrock, and more, with fallback/cooldown |
| `pkg/tools/` | Agent tools: shell, filesystem, edit, cron, MCP, search, spawn, send_file, skills |
| `pkg/session/` | Conversation persistence: JSONL backend and Manager API backend |
| `pkg/routing/` | Agent-ID normalization, session keys, runtime routing |
| `pkg/skills/` | ClawHub skill registry / installer / loader |
| `pkg/channels/` | Ported chat channels (Telegram, Discord, ...) — **not used in the voice path** |
| `third_party/ten-vad/` | TEN VAD native library (`.dll` / `.so` / macOS framework) |
| `deploy/`, `docker/`, `scripts/` | K8s manifests, Dockerfiles, build/DB-seed scripts |

## Worker model

The binary registers with the LiveKit server as an **agent worker** over WebSocket (`pkg/livekit/worker.go`) and speaks the LiveKit agent dispatch protocol:

```
picoclaw-livekit --agent-name cheeko-agent
        │
        ▼
LiveKit server ── AvailabilityRequest ──► worker
        │                                   │ accepts
        └────────── JobAssignment ─────────►│
                                            ▼
                              RoomSession (WebRTC join, one per room)
                              AgentBridge (agent loop, one per job)
```

- **RoomSession** (`pkg/livekit/room_session.go`) joins the room via WebRTC (pion), subscribes to the caller's mic PCM track, and publishes a PCM track for TTS output.
- **AgentBridge** runs the agent loop for the job: pipeline events in, LLM/tool calls, spoken responses out.
- Concurrency is capped by `MaxSessions` (default 100).
- It is **not** a webhook server — the only HTTP surface is `/health` and `/ready` on `HealthPort`.

## Runtime agents

Workers are started under an **agent name** which the MQTT gateway uses for dispatch. Multiple names (e.g. `cheeko-agent`, `cheeko-agent1`, `cheeko-agent2`) act as *runtime agent versions*, letting new builds run side-by-side and be routed per device. The default is set by the Manager API (`LIVEKIT_DEFAULT_AGENT`, default `cheeko-agent`).

## Session context

The physical toy is keyed by **MAC address**. Session context — child profile, character, language, and the RFID **AI card** UID when a card triggered the session — arrives in the LiveKit room metadata (`job.Room.Metadata` JSON), placed there by the MQTT gateway at room creation.

## Related pages

- [Voice Pipeline](./voice-pipeline.md) — VAD, STT, LLM, TTS, barge-in, data-channel commands
- [Workspace & Persona](./workspace-persona.md) — AGENT.md/SOUL.md, tools, skills, session persistence
- [Config & Deployment](./config-deployment.md) — configuration, build, Kubernetes
