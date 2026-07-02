---
id: overview
sidebar_position: 1
---

# Imagine Server Overview

The Imagine server (repo [Craftech360-projects/line_art](https://github.com/Craftech360-projects/line_art)) is a Python **FastAPI** service that turns a child's spoken (or typed) prompt into an image. One pipeline serves two device features:

| Feature | Output | Gate |
|---|---|---|
| **AI Printer** | 1-bit monochrome bitmap, 384 px wide — printed on the toy's thermal printer | Waits for `print_confirm` from the device |
| **AI Imagine** | Color JPEG, 320×240, ≤200 KB — shown full-screen on the toy's LCD | Generates immediately, no confirm step |

:::info Status
The server is functional for both paths, and the Manager API has `/toy/imagine` delivery routes (upload → S3 → CDN URL). Device firmware integration for AI Imagine is **in progress** — the device⇄server contract lives in `ai-imagine-backend-spec.md` and ADR `0001-imagine-image-delivery-via-gateway-upload.md` in the repo.
:::

## Service shape

- Entry point: `app/main.py` (`uvicorn app.main:app`), port **8090**.
- Single API surface: `GET/WS /ws` — the protocol (device vs browser test client) is auto-detected from the first message.
- No database; sessions are in-memory per WebSocket. Every generation is also saved locally under `generated_images/`.

## Device protocol

Spoken by the Cheeko firmware / MQTT gateway (`app/device_protocol.py`):

```
device → hello {feature?: "ai_imagine"}          server → hello {session_id, audio_params}
device → listen {state:"start"}
device → <raw Opus frames, 16 kHz mono, 60 ms>
device → listen {state:"stop"}
                                                 server → line_art_transcription {text}
                                                 server → line_art_progress {message, stage}
Printer path:                                    server → line_art {raw_mono, width:384, height}
device → print_confirm | print_reject
Imagine path (no confirm):                       server → image {image: b64 JPEG, width:320,
                                                                 height:240, caption}
Errors:                                          server → line_art_error {message, stage}
```

## Browser test protocol

`static/index.html` and `static/device.html` provide test clients: send `{"type":"text_input","text":"a cat"}` or raw WAV bytes; receive `progress`, `transcription`, `result` (data-URI image + raw mono bitmap), `error`. Schemas in `app/models.py`.

## Who calls it

```
ESP32 toy ──MQTT/UDP──► mqtt-gateway ──feature:"ai_imagine"──► ws://imagine:8090/ws
                             │                                        │
                             │  image bytes ◄─────────────────────────┘
                             ▼
                  POST manager-api /toy/imagine  ──► S3 (imagine/ prefix)
                             │
                             ▼
                  https://cdn.cheekoai.in/... URL ──MQTT image{url}──► toy (HTTPS GET + render)
```

The gateway takes this "shortcut" for imagine sessions — LiveKit and the Go voice agent are bypassed entirely. The Imagine server itself never touches MQTT or S3; it only speaks WebSocket and returns image bytes.

For the generation pipeline (STT, moderation, FLUX backends, bitmap packing) see [Image Pipeline](./image-pipeline.md).
