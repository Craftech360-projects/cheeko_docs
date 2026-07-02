---
id: mobile-api
sidebar_position: 7
---

# Mobile API (`/toy/api/mobile`)

The Firebase-authenticated REST surface consumed by the Flutter [Parent App](../../mobile/parent-app.md). Routes live in `mobile.routes.js` and `profile.routes.js`, all behind `requireFirebaseAuth`: the app attaches `Authorization: Bearer <Firebase ID token>`, the middleware verifies it via `firebase-admin` and finds-or-creates the matching `sys_user` row.

All responses use the standard `{code, msg, data}` envelope; `code == 401` signals an expired session.

## Endpoint groups

### Parent profile & account

| Method + Path | Purpose |
|---|---|
| `GET/POST/PUT /toy/api/mobile/parent-profile` | Read/create/update parent profile |
| `POST /toy/api/mobile/parent-profile/fcm-token` | Register FCM push token |
| `GET/POST/PUT /toy/api/mobile/user-state` | Onboarding state tracking |
| `DELETE /toy/api/mobile/account` | Delete account and associated data |
| `GET /toy/api/mobile/check-email` | Email existence check |

### Kids

| Method + Path | Purpose |
|---|---|
| `GET/POST /toy/api/mobile/kids` | List / create kid profiles |
| `PUT/DELETE /toy/api/mobile/kids/{id}` | Update / delete a kid |
| `GET /toy/api/mobile/active-kid` | Currently active kid |
| `POST /toy/api/mobile/switch-active-kid` | Switch active kid |

### Agents (characters)

| Method + Path | Purpose |
|---|---|
| `GET/POST /toy/api/mobile/agents` | List / create agents |
| `GET/PUT/DELETE /toy/api/mobile/agents/{id}` | Agent detail / update / delete |
| `GET /toy/api/mobile/agents/{id}/devices` | Devices bound to an agent |
| `POST /toy/api/mobile/agents/{id}/bind/{deviceCode}` | Bind a device by activation code |
| `GET /toy/api/mobile/agents/{id}/sessions` | Conversation sessions |
| `GET /toy/api/mobile/agents/{id}/chat-history/{sessionId}` | Session transcript |
| `GET /toy/api/mobile/agents/device/{mac}/agent-id` | Resolve agent for a device |

### Devices & settings

| Method + Path | Purpose |
|---|---|
| `GET /toy/api/mobile/devices`, `/user-devices` | List bound devices |
| `GET/PATCH /toy/api/mobile/devices/{mac}/settings` | Device settings (quiet hours, autoplay, notifications) |
| `GET /toy/api/mobile/devices/{mac}/state` | Last reported device state |
| `GET /toy/api/mobile/devices/{mac}/sync-events` | Settings sync/ack history |
| `POST /toy/api/mobile/devices/{mac}/analytics/events` | Analytics event ingestion |
| `PUT /toy/api/mobile/devices/assign-kid-by-mac` | Assign a kid profile to a device |

Settings changes are propagated to the device by the backend: Manager API → gateway internal API (`:8091/internal/settings/publish-update`) → MQTT `settings_update` → device ack → `device_sync_event`.

### Activation

| Method + Path | Purpose |
|---|---|
| `POST /toy/api/mobile/activation/check-code` | Validate an activation code |
| `POST /toy/api/mobile/activation/validate` | Validate + claim |
| `GET /toy/api/mobile/activation/devices` | Activated devices |
| `POST /toy/api/mobile/activation/deactivate/{id}` | Deactivate |
| `GET /toy/api/mobile/activation/toy-details/{id}`, `/child-info/{id}` | Activation detail lookups |

### Home & progress

| Method + Path | Purpose |
|---|---|
| `GET /toy/api/mobile/homepage-activity` (+ `/details`) | Home-tab activity feed |
| `GET /toy/api/mobile/progress/summary`, `/details`, `/trend` | Learning progress |
| `GET /toy/api/mobile/homepage-recommendations` | Content recommendations |

## Related non-mobile endpoints the app also uses

- `POST /toy/ota/` — MQTT credentials for the app's remote-control connection (device-id header, no Firebase auth)
- `GET/POST /toy/agent/device/{mac}/current-character` / `set-character` — persona switching
- `/toy/agent/voice-print/*`, `/toy/agent/template` — voice-print enrollment, role templates
- `/toy/analytics/*` — usage/progress/session statistics
- `/toy/content/library*` — content browsing
