# Cheeko Docs Refresh — Design (2026-07-02)

## Goal

Bring the Docusaurus docs site (d:\cheeko_docs\docs-site) in line with the current
architecture. The Python `livekit-server` voice agent was replaced by a Go LiveKit
agent worker (`picoclaw-livekit`, D:\picoclaw); a new image-generation service
("Imagine Server", D:\line_art) exists; manager-api-node and the parent app have
evolved substantially.

Approach chosen: **targeted restructure** — new sections for the Go voice agent and
Imagine server, full rewrites of stale pages, and a verified logic-check pass over
every remaining page (no page ships unreviewed).

## Ground truth (from source exploration, 2026-07-02)

| Component | Location | Reality |
|---|---|---|
| Voice agent | D:\picoclaw | Go 1.25 LiveKit agent worker `picoclaw-livekit`. TEN VAD → DB-driven STT factory (Deepgram default, 15+ providers) → per-session LLM (Manager-selected) → TTS factory (ElevenLabs default; Deepgram/Cartesia/Inworld). Per-device ephemeral workspace (AGENT.md/SOUL.md/MEMORY.md pulled from Manager), voice tool allowlist, cron/spontaneous speech, MCP, skills. Deployed on Kubernetes/EKS (HPA, PDB). Old Python livekit-server still on disk but legacy. |
| Manager API | D:\cheeko-backend\main\manager-api-node | Express 4 + Prisma 7 on DigitalOcean PostgreSQL (~75 models). No Redis. Port 8002, base `/toy`. New route groups: `/toy/livekit` (active provider config for voice worker), `/toy/imagine` (S3/CDN image delivery), `/toy/api/mobile` (Firebase-auth mobile surface), device-sync, ttsVoice, usage, email reports, admin-dashboard persona editor mount. Talks to gateway internally via HTTP :8091. |
| MQTT Gateway | D:\cheeko-backend\main\mqtt-gateway | Still the MQTT/UDP ↔ LiveKit bridge. Dispatches Go agent (cheeko-agent*). Internal HTTP :8091 for settings publish. Imagine shortcut: forwards Opus to line_art ws :8090, uploads result to `/toy/imagine`. |
| Imagine server | D:\line_art | FastAPI, single WS endpoint :8090/ws, device + browser protocols. Groq Whisper STT (or local Speaches), 2-layer child-safety moderation, FLUX.1-schnell (HF API or local ComfyUI). Two outputs: 1-bit 384px printer bitmap (print_confirm-gated) and 320×240 JPEG ≤200KB for LCD (AI Imagine). Device firmware integration in progress. |
| Parent app | D:\Cheeko-mobile_app\CheekoAI-Parent-App | Flutter v3.8.17+113 (branch new-ui). Tabs: Home / Device / Cards(Analytics) / Profile. BLE BluFi provisioning + SoftAP fallback, QR + activation-code binding, voice-print mgmt, quiet hours/device settings, FCM, Shorebird OTA. Endpoints largely under `/toy/api/mobile/*`. Base URLs ota.cheekoai.in / otadev.cheekoai.in. |

## Sidebar restructure

- Backend gains **Voice Agent (Go · picoclaw)** category: `overview`,
  `voice-pipeline`, `workspace-persona`, `config-deployment` (4 new pages).
- Old **LiveKit Server (AI)** category moves to **Legacy: LiveKit Server (Python)**,
  collapsed, each page gets a deprecation banner pointing at the new section.
- New top-level **Imagine Server** category: `overview`, `image-pipeline` (2 new pages).
- Manager API category gains `mobile-api` page (Firebase `/toy/api/mobile` surface).
- Everything else keeps its slug (no broken inbound links).

## Per-page actions

| Page | Action |
|---|---|
| intro.md | Rewrite: component table (Go agent, imagine server), new data-flow diagram, ports |
| architecture/overview.md | Rewrite: system diagram, component responsibilities, external services |
| architecture/protocols.md | Verify + fix (contracts mostly unchanged) |
| firmware/integration-guide.md | Verify + fix agent-side references |
| backend/database-schema.md | Update: Postgres/DigitalOcean, Prisma, current model groups |
| backend/mcp-protocol.md | Verify + fix |
| backend/manager-api/overview.md | Update: stack, route-group table, integrations |
| backend/manager-api/{ota,device,agent,content,rfid}.md | Verify + fix each |
| backend/manager-api/mobile-api.md | NEW |
| backend/mqtt-gateway/{overview,mqtt-protocol,audio-pipeline}.md | Update: Go agent dispatch, :8091, imagine shortcut; verify rest |
| backend/voice-agent/*.md | NEW ×4 |
| backend/livekit-server/*.md | Move under Legacy label + deprecation banner; content frozen |
| imagine/{overview,image-pipeline}.md | NEW ×2 |
| rfid/overview.md | Verify + fix |
| admin/manager-web.md | Verify + fix; mention admin-dashboard persona editor |
| mobile/parent-app.md | Rewrite against v3.8.17 |
| deployment/environment.md | Update env tables per service |
| deployment/pm2.md | Update: PM2 for Node services, K8s/EKS for voice agent |
| deployment/scaling.md | Update |

## Verification

- Three source-diff agents check every verify+fix page against the actual repos;
  corrections applied from their reports.
- `npm run build` must pass (Docusaurus fails on broken links) before done.

## Out of scope

- Documenting committed secrets (flagged to owner separately: line_art/.env keys,
  Firebase admin JSON + hardcoded bearer in the app repo).
- Changes to any source repo.
