# Cheeko Docs Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Docusaurus docs site in line with the current Cheeko architecture (Go picoclaw-livekit voice agent, Imagine server, evolved manager-api and parent app).

**Architecture:** Targeted restructure per `superpowers/specs/2026-07-02-docs-refresh-design.md`: 7 new pages, 4 legacy-bannered pages, ~8 rewritten pages, ~11 verified fix-pass pages, one sidebar update. Facts come from four source-exploration reports (picoclaw, manager-api-node, line_art, parent app) and three doc-vs-source verification reports.

**Tech Stack:** Docusaurus 3 (classic), markdown docs under `docs/`, sidebar in `sidebars.js`. Build gate: `npm run build` (fails on broken links).

## Global Constraints

- Existing page slugs/ids must not change (inbound links); new pages get new slugs.
- Legacy Python pages keep content frozen; only a deprecation `:::warning` banner is added.
- Every stated fact must trace to a source-exploration or verification report; no invented endpoints/values.
- Do not document committed secrets (API keys, bearer tokens, PINs).
- AI Imagine device-firmware integration documented as "in progress".
- Production deployment facts: voice agent on Kubernetes/EKS; Node services PM2/Docker.

---

### Task 1: Legacy banners on Python livekit-server pages

**Files:** Modify `docs/backend/livekit-server/{overview,cheeko-agent,game-workers,function-tools}.md`

- [ ] Add after front matter of each: a `:::warning Deprecated` banner stating the Python livekit-server was replaced by the Go voice agent (link `/backend/voice-agent/overview`), code remains at `main/livekit-server` but is no longer deployed.
- [ ] No other content changes.

### Task 2: New Voice Agent section (4 pages)

**Files:** Create `docs/backend/voice-agent/overview.md`, `voice-pipeline.md`, `workspace-persona.md`, `config-deployment.md`

- [ ] `overview.md`: what picoclaw-livekit is (Go 1.25 fork of sipeed/picoclaw turned LiveKit agent worker), repo layout (cmd/picoclaw-livekit, pkg/livekit, pkg/voice, pkg/agent, pkg/providers, pkg/session, pkg/routing, pkg/skills), worker dispatch model (WebSocket AvailabilityRequest→JobAssignment, RoomSession per room, AgentBridge per job, MaxSessions 100), runtime agent names (cheeko-agent, cheeko-agent1/2), health endpoint, how it replaced the Python workers (personas in Manager DB instead of per-game workers).
- [ ] `voice-pipeline.md`: TEN VAD (16kHz, threshold 0.7, endpoint 1000ms, barge-in), STT factory (Postgres `stt_providers` table, deepgram default; groq/assemblyai/openai/cartesia/elevenlabs/gradium/mistral/sarvam/xai/...), LLM per session (Manager-selected, temp 0.3, voice token cap, tool allowlist), TTS factory (elevenlabs default; deepgram aura-2, cartesia, inworld; PCM format), sentence segmentation, LiveKit data-channel commands (ready_for_greeting, end_prompt, shutdown_request, abort, session_language_update), async tools/spontaneous speech.
- [ ] `workspace-persona.md`: per-device ephemeral workspace (AGENT.md from system_prompt, SOUL.md from soul, USER.md, MEMORY.md, skills from workspace-template), Manager pull-by-name persona, distributed workspace locks (fencing tokens, last-tap-wins), voice tool allowlist (filesystem/edit, cron spoken reminders, MCP, spawn, search, send_file), session persistence to Manager (bootstrap, messages, saveMemory, summary/end), domain terms (Character/Persona/Runtime Agent/Governing Prompt/AI Card).
- [ ] `config-deployment.md`: config.json + .security.yml + `PICOCLAW_LIVEKIT_*` env (server_url, api key/secret, MANAGER_API_URL/SERVICE_KEY, STT_DATABASE_URL/DIRECT_URL, runtime knobs), build (CGO: opus/soxr/TEN VAD; scripts/build-livekit.ps1, Makefile), run (`picoclaw-livekit --agent-name cheeko-agent`), production = Kubernetes/EKS (`deploy/k8s`: deployment, HPA, PDB, PodMonitor; Dockerfile.eks, port 8192), alternates: docker-compose.livekit.yml, Dockerfile.cerebrium.

### Task 3: New Imagine Server section (2 pages)

**Files:** Create `docs/imagine/overview.md`, `docs/imagine/image-pipeline.md`

- [ ] `overview.md`: FastAPI service (`app/main.py`, port 8090, single `GET/WS /ws`), two features on one pipeline — AI Printer (1-bit 384px mono bitmap, print_confirm-gated) and AI Imagine (320×240 JPEG for LCD, immediate); device protocol (hello→listen start/stop→Opus frames; server msgs line_art_transcription/progress/line_art/image/error) and browser test protocol; who calls it (gateway shortcut on `feature:"ai_imagine"`, bypassing LiveKit; upload to manager-api `/toy/imagine` → S3 → CDN URL → MQTT image{url}); status note: device firmware integration in progress.
- [ ] `image-pipeline.md`: STT (Groq whisper-large-v3 or local Speaches), moderation (keyword blocklist + Groq llama-3.1-8b-instant classifier, fails open), generation (FLUX.1-schnell via HF API default or local ComfyUI fp8, 4 steps), outputs (MONO_THRESHOLD 190 1-bit packing 48B/row; imagine 512×384→letterbox 320×240 JPEG quality 85→35 ≤200KB, fallback.jpg), env table (STT_BACKEND, IMAGE_BACKEND, MODERATION_BACKEND, GROQ_*, HF_*, SPEACHES_*, COMFYUI_*), run (docker compose speaches+comfyui, uvicorn :8090).

### Task 4: New mobile-api page

**Files:** Create `docs/backend/manager-api/mobile-api.md`

- [ ] Firebase-auth surface under `/toy/api/mobile` (requireFirebaseAuth, Bearer Firebase ID token, `{code,msg,data}` envelope): parent-profile + FCM token, user-state, kids CRUD/active-kid, agents CRUD + bind/unbind + sessions/chat-history, devices + settings (GET/PATCH) + state + sync-events + analytics events, activation (check-code/validate/...), account delete, home/progress endpoints. Use exact endpoint list from mobile-app + manager-api verification reports.

### Task 5: Rewrite core pages

**Files:** Modify `docs/intro.md`, `docs/architecture/overview.md`, `docs/mobile/parent-app.md`, `docs/backend/database-schema.md`, `docs/backend/manager-api/overview.md`

- [ ] `intro.md`: component table (voice agent Go/picoclaw, manager-api-node, mqtt-gateway, imagine server, manager-web, admin-dashboard, firmware, parent app Flutter), updated flow diagram incl. imagine path, port table (8002 API, 8091 gateway internal, 8090 imagine, 1883 EMQX, 8192 voice health).
- [ ] `architecture/overview.md`: new system diagram (Go agent + imagine server), boot-to-conversation phases (verify unchanged), component responsibilities, external services table (drop Supabase-as-DB, add DigitalOcean Postgres, TEN VAD, FLUX/HF/ComfyUI, Firebase, S3/CDN, K8s).
- [ ] `mobile/parent-app.md`: rewrite against v3.8.17 new-ui — tabs Home/Device/Cards/Profile, BLE BluFi primary + SoftAP fallback provisioning (provisioning_coordinator), QR + activation-code binding, voice-print management, device settings/quiet hours, FCM, Shorebird, developer options, endpoint table from report, MQTT remote-control section (verify topics unchanged).
- [ ] `database-schema.md`: PostgreSQL on DigitalOcean via Prisma 7 (~75 models), model groups (agents, devices+settings+runtime state, voice_sessions*, provider tables, RFID, content, users/profiles, memory/workspace, analytics, system), corrections from verification report.
- [ ] `manager-api/overview.md`: stack (Express 4, Prisma 7 + pg adapter, no Redis), full route-group table incl. /toy/livekit, /toy/imagine, /toy/api/mobile, device-sync, ttsVoice, usage, email reports, admin-dashboard mount; integrations (gateway :8091, Qdrant, Mem0, S3/MinIO, Firebase admin, SMTP cron).

### Task 6: Deployment pages update

**Files:** Modify `docs/deployment/{environment,pm2,scaling}.md`

- [ ] `environment.md`: per-service env tables from reports (manager-api, gateway, voice agent PICOCLAW_LIVEKIT_*, imagine server).
- [ ] `pm2.md`: PM2 scope = Node services; voice agent runs on K8s/EKS; update ecosystem snippet to current reality per gateway verification report.
- [ ] `scaling.md`: voice agent HPA/MaxSessions/K8s; gateway worker pool; corrections from verification report.

### Task 7: Verified fix-pass (apply verification-report corrections)

**Files:** Modify `docs/architecture/protocols.md`, `docs/firmware/integration-guide.md`, `docs/backend/mcp-protocol.md`, `docs/backend/mqtt-gateway/{overview,mqtt-protocol,audio-pipeline}.md`, `docs/backend/manager-api/{ota,device,agent,content,rfid}.md`, `docs/rfid/overview.md`, `docs/admin/manager-web.md`

- [ ] For each page, apply the corrections from the three verification agents ("doc says X → source says Y"); replace Python-agent references with Go voice agent; add gateway imagine shortcut + :8091 internal API where relevant; keep verified-accurate content untouched.

### Task 8: Sidebar + build gate

**Files:** Modify `sidebars.js`

- [ ] Add Voice Agent (Go · picoclaw) category, Imagine Server category, mobile-api entry; rename LiveKit section label to "Legacy: LiveKit Server (Python)" with `collapsed: true`.
- [ ] Run `npm run build` in docs-site. Expected: exit 0, no broken links. Fix any failures.
- [ ] Commit: `git add -A && git commit -m "docs: refresh for Go voice agent, imagine server, current backend/app"`.
