---
id: voice-pipeline
sidebar_position: 2
---

# Voice Pipeline

The audio path per session is an explicit four-stage pipeline (`pkg/livekit/audio_pipeline.go`):

```
mic PCM (LiveKit track)
   │
   ▼
TEN VAD ──► STT (streaming) ──► LLM ──► TTS ──► PCM track (LiveKit)
   │              │                              ▲
   │ barge-in     │ transcripts                  │ sentence-by-sentence
   └──────────────┴── interruption stops TTS ────┘
```

## VAD — TEN VAD

Voice activity detection uses **TEN VAD** via cgo (`pkg/voice/vad/ten_vad.go`), running at 16 kHz.

| Knob | Default | Purpose |
|---|---|---|
| VAD threshold | 0.7 | Speech probability cutoff |
| `VADEndpointMS` | 1000 ms | Trailing silence that ends the child's turn |

VAD drives both **endpointing** (when to send the utterance to the LLM) and **barge-in**: if the child speaks while the agent is talking, TTS playback is interrupted.

## STT — database-driven provider factory

STT providers are configured in a PostgreSQL table (`stt_providers`), not in code (`pkg/voice/stt/factory.go`). The worker reads the active provider and priority order at startup from `STT_DATABASE_URL` / `DIRECT_URL`; seed SQL lives at `scripts/stt_providers_postgres.sql`.

Built-in providers: **Deepgram** (streaming, default), Groq (whisper-large-v3), AssemblyAI, OpenAI (whisper-1), Cartesia (ink-whisper), ElevenLabs (scribe), Gradium, Mistral/Voxtral, Sarvam (saaras), xAI, Azure, Google Speech, Gladia, Soniox, Speechmatics.

## LLM — per-session provider selection

The LLM is chosen per session: the worker first asks the Manager API for the active provider config (`GET /toy/livekit/providers/active`, service-key auth) and falls back to its own startup config. Supported providers (`pkg/providers/`): Anthropic, OpenAI-compatible, Gemini/Google, Ollama, Bedrock, Azure OpenAI, GitHub Copilot, Codex/Claude CLI, xAI, and OpenRouter/Zhipu/ModelScope via config, with fallback and cooldown handling.

Voice sessions run with a voice-specific `max_tokens` cap, `temperature=0.3`, and a restricted tool allowlist (see [Workspace & Persona](./workspace-persona.md)).

## TTS — provider factory

TTS is a builder registry (`pkg/voice/tts/factory.go`): **ElevenLabs** (default), **Deepgram** (aura-2), **Cartesia**, **Inworld**. The Manager API can override provider and voice per session. Output sample rate is parsed from the format string (e.g. `pcm_24000`).

LLM output is segmented into sentences (`neurosnap/sentences`) and streamed to TTS sentence-by-sentence, so speech starts before the full response is generated.

## Control channel (LiveKit DataChannel)

Commands from the MQTT gateway arrive over the LiveKit data channel (`RoomSession.OnDataReceived`), and acks are published back via `PublishData`:

| Command | Effect |
|---|---|
| `ready_for_greeting` | Device is ready; agent speaks its greeting (greeting policy configurable) |
| `abort` | Stop speaking immediately (child pressed/interrupted) |
| `end_prompt` | Speak a closing line before session end |
| `session_language_update` | Switch session language mid-conversation |
| `shutdown_request` | Gracefully end the session |

## Async tools and spontaneous speech

Tool calls run in **detached goroutines** (`pkg/livekit/agent_bridge.go`) so conversation is never blocked on a slow tool. When an async tool completes — e.g. a cron reminder fires — an `AsyncEvent` is queued and the bridge generates a **spontaneous spoken line**, letting Cheeko say things unprompted ("Time to brush your teeth!").
