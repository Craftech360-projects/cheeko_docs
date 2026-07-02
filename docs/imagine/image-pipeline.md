---
id: image-pipeline
sidebar_position: 2
---

# Image Pipeline

Every request flows through four stages (`app/image_gen.py` orchestrates):

```
Opus audio ──► STT ──► child-safety moderation ──► image generation ──► output packing
```

## 1. Speech-to-text (`app/stt.py`)

Selected by `STT_BACKEND`:

| Backend | Provider | Model |
|---|---|---|
| `groq` (default) | Groq cloud | `whisper-large-v3` |
| `local` | Speaches (self-hosted, GPU) | `faster-whisper-large-v3` |

Both are OpenAI-compatible `/v1/audio/transcriptions` endpoints. Raw Opus frames are decoded to WAV first (`app/opus_decode.py`).

## 2. Child-safety moderation

Two layers, both applied to the transcribed prompt:

1. **Keyword blocklist** (`image_gen._assert_child_safe`) — violence, weapons, horror, sexual content, substances, etc.
2. **LLM classifier** (`app/moderation.py`) — Groq `llama-3.1-8b-instant` returns SAFE/UNSAFE, handles multiple languages. Fails **open** (a classifier outage doesn't block generation; the keyword layer still applies).

Blocked prompts surface to the device as a `safety_block` error stage.

## 3. Image generation

Selected by `IMAGE_BACKEND`, both running **FLUX.1-schnell**:

| Backend | Where | Details |
|---|---|---|
| `hf` (default) | HuggingFace Inference API | `black-forest-labs/FLUX.1-schnell` via `router.huggingface.co` |
| `comfyui` | Local ComfyUI, NVIDIA GPU | fp8 single-file checkpoint, 4 steps, euler/simple, cfg 1.0; submit `/prompt`, poll `/history`, fetch `/view` (`app/comfy_client.py`, workflow in `app/comfy_workflow.py`) |

Prompts are wrapped in a kid-safe template; for imagine mode the subject phrase is extracted (`_clean_subject`) and rendered at 512×384 (4:3).

## 4. Output packing

**Printer path** (`to_raw_mono`): resize to 384 px wide (LANCZOS, aspect preserved) → grayscale → fixed threshold `MONO_THRESHOLD=190` (no dithering) → pack 1-bit MSB-first, 48 bytes/row, headerless.

**Imagine path** (`generate_imagine_jpeg` / `to_device_jpeg`): letterbox onto a 320×240 white canvas → baseline JPEG, quality stepping down 85→35 until ≤200 KB. On backend failure the bundled `fallback.jpg` is served instead of an error.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `STT_BACKEND` | `groq` | `groq` \| `local` |
| `IMAGE_BACKEND` | `hf` | `hf` \| `comfyui` |
| `MODERATION_BACKEND` | `groq` | `groq` \| `off` |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_LLM_MODEL` | — | STT + moderation models |
| `HF_API_TOKEN`, `HF_MODEL_URL` | — | HuggingFace FLUX endpoint |
| `SPEACHES_BASE_URL`, `SPEACHES_MODEL` | `:8001` | Local STT |
| `COMFYUI_BASE_URL`, `COMFYUI_TIMEOUT_S` | `:8188`, 20 s | Local image gen |
| `MONO_THRESHOLD` | 190 | Printer 1-bit threshold |
| `IMAGINE_FALLBACK_IMAGE` | `fallback.jpg` | Served on generation failure |
| `SAVE_DEVICE_AUDIO`, `SAVE_INPUT_AUDIO` | off | Debug WAV dumps to `debug_audio/` |

## Running

```bash
# Optional local GPU backends
docker compose up -d speaches comfyui   # FLUX checkpoint (~17 GB) under comfyui-data/models/checkpoints/

# The app itself
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

The app boots even when Speaches/ComfyUI are down — backend errors are returned lazily per request. Tests: `pytest` suite under `tests/`; CLI/GUI device simulators at `ai_printer_client.py` / `ai_printer_gui.py`.
