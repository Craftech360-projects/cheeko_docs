---
id: workspace-persona
sidebar_position: 3
---

# Workspace & Persona System

This is the part of picoclaw that made the port worthwhile: each voice session runs inside an **ephemeral per-device workspace** — a sandboxed folder of markdown files and skills that defines who the agent is and what it remembers.

## Domain terms

| Term | Meaning |
|---|---|
| **Character** | A named personality a parent can pick (Cheeko, Math Tutor, ...) |
| **Persona** | The character's prompt content: `system_prompt` (behavior) + `soul` (personality), stored in the Manager API DB (`ai_agent`) |
| **Runtime Agent** | A deployed worker registration (`cheeko-agent`, `cheeko-agent1`, ...) that serves sessions |
| **Governing Prompt** | Fixed child-safety rules layered on top of every persona |
| **Parent Rule** | Per-family overrides layered by parents |
| **AI Card** | RFID card mapping to a character + language; tapping it starts that character's session |

Personas are **Manager-owned**: the worker pulls them by character name/ID at session start, so editing a persona in the admin dashboard changes behavior on the next session without redeploying the agent.

## Workspace lifecycle

For each room the worker creates and locks `workspace-<agentID>/`, hydrated from `workspace-template/` plus Manager data:

| File | Source | Purpose |
|---|---|---|
| `AGENT.md` | Scaffold + persona `system_prompt` | Behavior instructions |
| `SOUL.md` | Persona `soul` | Personality/voice |
| `USER.md` | Child profile | Who the agent is talking to |
| `MEMORY.md` | Manager-synced memories | Long-term memory for this device |
| `skills/` | Copied from template + installed skills | ClawHub skills available to the agent |

On session close the workspace is synced back to the Manager API and removed. The persona prompt template (`prompts/cheeko.tmpl`, Jinja-style syntax) is rendered against the child profile and memories.

### Distributed workspace locks

Because multiple worker replicas run behind the LiveKit dispatcher, per-device workspaces are guarded by **distributed locks in the Manager API** with fencing tokens. Lock policy is *last-tap-wins*: a new session for the same device preempts the old one's lock.

## Voice tool allowlist

The full picoclaw tool registry is ported, but voice sessions filter it through an allowlist (`isLiveKitVoiceAllowedTool` in `cmd/picoclaw-livekit/main.go`):

| Tool | Voice use |
|---|---|
| filesystem / read / write / edit | Workspace files (memory, notes) |
| cron | Scheduled **spoken reminders** (delivered as spontaneous speech) |
| MCP tools | External tool servers, initialized async per room |
| spawn | Sub-agents for background work |
| search | Web/content search |
| send_file | Deliver files out of the session |

## Session persistence (Manager API backend)

`pkg/session/manager_api_backend.go` persists conversation state to the Manager API:

| Call | Purpose |
|---|---|
| `GET /toy/agent/device/{mac}/bootstrap` | Session bootstrap: persona, child profile, settings |
| `POST /toy/agent/.../sessions/{id}/messages` | Chat history messages |
| `POST /toy/agent/saveMemory/{mac}` | Persist extracted memories |
| Session summary / end endpoints | Room-close summary and cleanup (written to `voice_sessions*` tables) |

There is also a JSONL backend (`jsonl_backend.go`) for local development.

:::note Brand rule
The persona (`cheeko.md`) includes an identity guard: the agent attributes itself only to **ALTIO AI PRIVATE LIMITED** and never discloses underlying providers (Gemini, OpenAI, ElevenLabs, LiveKit, AWS, ...).
:::
