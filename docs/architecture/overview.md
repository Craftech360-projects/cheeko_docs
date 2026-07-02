---
id: overview
sidebar_position: 1
---

# Architecture Overview

![Architecture](/img/architecture-header.jpeg)

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ESP32 Device (Firmware)                      │
│  - State machine (idle/connecting/listening/speaking/...)           │
│  - MQTT client · UDP socket (AES-128-CTR encrypted Opus audio)      │
│  - RFID reader · SD card cache · thermal printer · LCD              │
└──────────────┬──────────────────────────────┬───────────────────────┘
               │ MQTT (publish/subscribe)     │ UDP (audio packets)
               ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   MQTT/UDP Gateway (Node.js)                        │
│  main/mqtt-gateway/                                                 │
│  - EMQX broker bridge · UDP server (AES-128-CTR Opus)               │
│  - VirtualMQTTConnection + LiveKitBridge per device                 │
│  - Internal HTTP :8091 (settings push from Manager API)             │
│  - AI Imagine shortcut: Opus ──► Imagine server ws :8090            │
└───────┬──────────────────┬──────────────────────────┬───────────────┘
        │ REST :8002       │ LiveKit (WebRTC)         │ WebSocket :8090
        ▼                  ▼                          ▼
┌──────────────────┐  ┌─────────────────────────┐  ┌──────────────────┐
│ Manager API      │  │ LiveKit + Voice Agent   │  │ Imagine Server   │
│ (Node/Express +  │  │ picoclaw-livekit (Go)   │  │ line_art (Py/    │
│  Prisma 7)       │  │ - TEN VAD → STT → LLM   │  │  FastAPI)        │
│ - Device registry│  │   → TTS pipeline        │  │ - Groq Whisper   │
│ - OTA/activation │  │ - DB-driven personas    │  │ - FLUX.1-schnell │
│ - Personas/agents│◄─┤   (AGENT.md/SOUL.md)    │  │ - printer bitmap │
│ - Providers cfg  │  │ - K8s/EKS + HPA         │  │   + LCD JPEG     │
│ - Content, RFID  │  └─────────────────────────┘  └────────┬─────────┘
│ - Mobile API     │◄──────────── image bytes upload ───────┘
│ - Analytics      │──► S3 ──► cdn.cheekoai.in URLs
└──────┬───────────┘
       │
       ▼
 PostgreSQL (DigitalOcean) · Qdrant · Mem0 · Firebase Auth · S3/CDN
       │
       ▼
 manager-web (Vue admin) · admin-dashboard (persona editor) · Parent App (Flutter)
```

All device-to-server communication starts with the Manager API (OTA), then shifts to the MQTT Gateway for real-time protocol.

## Service Port Map

| Service | Language | Port | Base Path | Notes |
|---------|----------|------|-----------|-------|
| manager-api-node | Node.js / Express | 8002 | `/toy` | Control plane; Swagger at `/toy/doc.html` |
| mqtt-gateway | Node.js | 1883 (via EMQX), 8091 internal | `/internal` | MQTT + UDP bridge; internal HTTP for settings push |
| Voice agent (picoclaw-livekit) | Go | 8192 | — | LiveKit agent worker; health/ready HTTP only |
| Imagine server (line_art) | Python / FastAPI | 8090 | `/ws` | Voice → image WebSocket |
| manager-web | Vue.js | — | — | Admin dashboard (nginx) |
| admin-dashboard | Node.js | — | `/admin-dashboard` | Persona editor, proxied through manager-api |
| MQTT broker (EMQX) | — | 1883 | — | Device MQTT endpoint |

## Boot-to-Conversation Flow: 8 Phases

| Phase | Name | Description |
|-------|------|-------------|
| 1 | OTA Check | Device POSTs to `/toy/ota/` — gets MQTT credentials, firmware info, activation status, server time |
| 2 | Activation Loop | If not activated, device polls `POST /toy/ota/activate` until it receives `200 success` |
| 3 | MQTT Connect + Hello | Device connects to EMQX broker and publishes `{"type":"hello"}` — gateway responds with server hello containing UDP credentials |
| 4 | UDP Channel Setup | Device opens UDP socket to the address in server hello; configures AES-128-CTR cipher |
| 5 | Mode Update (Deferred) | Gateway queries Manager API for device mode, character, and child profile; sends `{"type":"mode_update"}` to device |
| 6 | Conversation Loop | Bidirectional voice: device streams mic audio uplink (UDP), gateway streams TTS audio downlink (UDP); MQTT carries control messages |
| 7 | Abort / Interrupt | Device sends `{"type":"abort"}` to interrupt the assistant mid-speech; gateway stops TTS and waits for next listen |
| 8 | Session End | Either side sends `{"type":"goodbye"}`; device closes UDP channel and returns to idle without disconnecting MQTT |

```
Device Boot
    │
    ▼
[Phase 1] POST /toy/ota/
    │   ← Returns: mqtt creds, firmware info, activation status, server_time
    │
    ├─ If firmware update available → download firmware → reboot
    │
    ├─ If not activated → [Phase 2] POST /toy/ota/activate (loop)
    │
    ▼
[Phase 3] MQTT CONNECT (using OTA credentials)
    │
    ▼
Firmware publishes: {"type":"hello", ...}  →  Gateway
    │
    ▼
[Phase 4] Gateway returns: {"type":"hello", "udp":{server,port,key,nonce,...}, ...}
    │
    ▼
Firmware opens UDP socket to server:port
    │
    ▼
[Phase 5] Gateway sends (deferred): {"type":"mode_update", ...}
    │   (after querying Manager API for device mode/character/profile)
    │
    ▼
[Phase 6] Conversation loop begins
    │
    ├─ Firmware: {"type":"listen","state":"start","mode":"auto|manual|realtime"}
    ├─ Firmware→Gateway: UDP encrypted Opus audio packets (uplink)
    ├─ Firmware: {"type":"speech_end"}
    ├─ Gateway→Firmware: {"type":"llm","state":"think"}
    ├─ Gateway→Firmware: {"type":"tts","state":"start"}
    ├─ Gateway→Firmware: UDP encrypted Opus audio packets (downlink, 24kHz)
    ├─ Gateway→Firmware: {"type":"stt","text":"..."}  (user transcript)
    ├─ Gateway→Firmware: {"type":"llm","text":"...","emotion":"..."}
    └─ Gateway→Firmware: {"type":"tts","state":"stop"}
```

## Component Responsibilities

### ESP32 Firmware
- Implements the device state machine (`starting` → `activating` → `idle` → `connecting` → `listening` → `speaking`)
- Manages MQTT connection lifecycle and publishes/subscribes to control topics
- Sends mic audio as AES-128-CTR encrypted Opus frames over UDP (16kHz uplink); plays TTS audio received over UDP (24kHz downlink)
- Handles RFID card tap events; maintains local SD card cache of content skills

### mqtt-gateway
The real-time protocol hub (`main/mqtt-gateway/`). For each device session it maintains a `VirtualMQTTConnection` and a `LiveKitBridge`, resampling uplink audio from 16kHz to 24kHz before forwarding to LiveKit. It dispatches the Go voice agent by agent name into the room, forwards control commands over the LiveKit data channel, exposes an internal HTTP API on **:8091** that the Manager API calls to push `settings_update` messages to devices, and short-circuits AI Imagine sessions directly to the Imagine server.

### manager-api-node
The control plane. REST API on port 8002, base path `/toy`, Express 4 + Prisma 7 over PostgreSQL (DigitalOcean). Serves the firmware (OTA/activation), the gateway (config lookups), the voice agent (personas, provider config, session persistence), the parent app (Firebase-auth mobile API), and the admin surfaces. See [Manager API Overview](../backend/manager-api/overview.md).

### Voice agent (picoclaw-livekit)
A Go LiveKit agent worker. Joins rooms dispatched by the gateway, runs TEN VAD → STT → LLM → TTS with per-session personas (AGENT.md/SOUL.md) and provider config pulled from the Manager API, persists sessions back, and runs on Kubernetes with HPA. See [Voice Agent Overview](../backend/voice-agent/overview.md).

### Imagine server (line_art)
FastAPI voice-to-image service: Groq Whisper STT, two-layer child-safety moderation, FLUX.1-schnell generation, packed as thermal-printer bitmaps or 320×240 LCD JPEGs. See [Imagine Server](../imagine/overview.md).

## External Services

| Service | Purpose |
|---------|---------|
| LiveKit | Real-time voice WebRTC infrastructure and agent dispatch |
| PostgreSQL (DigitalOcean) | Primary database for manager-api (Prisma) and voice-provider tables |
| Firebase Auth | Parent app authentication (Google / Apple Sign-In) |
| AWS S3 + CloudFront (`cdn.cheekoai.in`) | Content and generated-image storage/delivery |
| Deepgram / Groq / AssemblyAI / others | STT providers (DB-selectable) |
| ElevenLabs / Deepgram Aura / Cartesia / Inworld | TTS providers |
| Anthropic / OpenAI / Gemini / Bedrock / others | LLM providers (Manager-selectable) |
| HuggingFace / ComfyUI (FLUX.1-schnell) | Image generation for AI Imagine / AI Printer |
| TEN VAD | On-worker voice activity detection |
| Qdrant | Vector search for RFID/content RAG |
| Mem0 | Long-term memory and personalization |
| EMQX | MQTT broker for device-to-gateway messaging |
| Kubernetes (EKS) | Voice agent production runtime (HPA, PDB) |
