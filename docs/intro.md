---
id: intro
slug: /
sidebar_position: 1
---

# Cheeko - Backend Overview

![Cheeko Hero](/img/cheeko-hero.png.jpeg)

Cheeko is an AI companion for children (ages 3–16) running on ESP32 devices, built by ALTIO AI. This documentation covers the backend services, the voice agent, the image server, firmware integration, and the parent app.

![Boot-to-Conversation Flow](/img/Boot-to-Conversation%20flow.jpeg)

## System Components

| Component | Language | Role |
|-----------|----------|------|
| **[Voice Agent (picoclaw-livekit)](https://github.com/Craftech360-projects/picoclaw-chat)** | Go | AI voice agent — LiveKit worker running VAD → STT → LLM → TTS with DB-driven personas. Replaced the Python livekit-server. |
| **manager-api-node** | Node.js / Express + Prisma | REST API — device registry, OTA, agent/persona config, content, analytics, mobile API. PostgreSQL (DigitalOcean). |
| **mqtt-gateway** | Node.js | Protocol bridge: MQTT/UDP (ESP32) ↔ LiveKit WebRTC; also routes AI Imagine audio to the Imagine server |
| **[Imagine Server (line_art)](https://github.com/Craftech360-projects/line_art)** | Python / FastAPI | Voice → image generation (FLUX.1-schnell): thermal-printer bitmaps and LCD images |
| **manager-web** | Vue.js | Admin dashboard for devices, users, models, and content |
| **admin-dashboard** | Node.js | Persona editor (AGENT.md / SOUL.md) proxying to the Manager API |
| **ESP32 Firmware** | C++ / ESP-IDF | On-device client — state machine, audio pipeline, MQTT, RFID |
| **Parent App** | Flutter | iOS/Android app for parents — device provisioning, kid profiles, content, analytics |

## High-Level Data Flow

```
ESP32 Device ──MQTT/UDP──► mqtt-gateway ──WebRTC──► LiveKit ──► Voice Agent (Go)
                  │             │                                    │
                  │             │ ai_imagine audio                   │ personas, providers,
                  │             ▼                                    │ session persistence
                  │        Imagine Server ──image──► manager-api ◄───┘
                  │        (FastAPI :8090)   bytes    (Node :8002)
                  │                                      │  ▲
                  │                                      ▼  │ Firebase-auth REST
                  └────────── OTA / activation ────► manager-web / admin-dashboard
                                                     Parent App (Flutter)
```

Device-to-server communication starts with the Manager API (OTA check and activation), then shifts to the MQTT Gateway for the real-time voice protocol. The Go voice agent pulls persona and provider configuration from the Manager API at session start and persists conversations back to it. For AI Imagine sessions, the gateway bypasses LiveKit and streams audio straight to the Imagine server, then delivers the generated image to the device via S3/CDN URL.

## Service Ports

| Service | Port | Base Path |
|---------|------|-----------|
| manager-api-node | 8002 | `/toy` |
| mqtt-gateway (internal HTTP, called by manager-api) | 8091 | `/internal` |
| Imagine server | 8090 | `/ws` |
| Voice agent (health/ready only) | 8192 | — |
| MQTT broker (EMQX) | 1883 | — |
| UDP audio channel | dynamic | — |

## Quick Start

- For a full picture of how all services connect, see the [Architecture Overview](./architecture/overview.md).
- For MQTT and UDP message contracts, see the [Protocol Reference](./architecture/protocols.md).
- For the AI voice agent, start at the [Voice Agent Overview](./backend/voice-agent/overview.md).
- For voice-to-image generation, see the [Imagine Server](./imagine/overview.md).

:::note
`manager-api-node` (Node.js/Express) is the backend API implementation, exposing all endpoints under `/toy`.
:::
