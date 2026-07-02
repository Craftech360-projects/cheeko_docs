---
id: parent-app
sidebar_position: 1
---

# Parent App

![Parent App](/img/parent-app-header.jpeg)

Flutter app for parents to set up and manage Cheeko devices, create child profiles, browse content, and monitor usage. Every device must be provisioned and bound to an account through this app before it can be used.

_This page reflects app version **3.8.17+113** (branch `new-ui`)._

## Tech Stack

| Item | Value |
|------|-------|
| Framework | Flutter (Dart), SDK `^3.7.2`; Android `com.cheekoai.in`, compileSdk 36, minSdk 24 |
| State management | Provider |
| Authentication | Firebase Auth — Google Sign-In (Android) and Apple Sign-In (iOS) |
| Push notifications | Firebase Messaging (FCM) + `flutter_local_notifications` |
| Device command channel | `mqtt_client` (^10.4.0) via EMQX broker |
| Device provisioning | **BLE (ESP BluFi, `esp_blufi` vendored in `third_party/`)** primary; SoftAP Wi-Fi fallback (`wifi_iot` + `wifi_scan`, `http://192.168.4.1`) — unified by `provisioning_coordinator` |
| Device binding | Activation code (`pinput`) or QR scan (`mobile_scanner`) |
| OTA / updates | Shorebird code push (auto-update) + `upgrader` store prompts |
| Config | `flutter_dotenv` (`.env`), runtime-switchable API environment |
| Secure storage | `flutter_secure_storage`, `shared_preferences` |

## Backend Environments

| Environment | Base URL |
|---|---|
| Production | `https://ota.cheekoai.in` |
| Development | `https://otadev.cheekoai.in` |

`ApiConfigService` reads the base URL from `.env` (`MOBILE_API_BASE_URL` takes precedence) and can switch environments at runtime via the Developer Options screen (stored in SharedPreferences). All API responses use the `{code, msg, data}` envelope; `code == 401` triggers session-expired handling.

## App Navigation

`MainNavigationScreen` has **four tabs** plus a floating assistive button:

| Tab | Screen | Purpose |
|---|---|---|
| Home | `home_screen.dart` | Activity dashboard, progress summary, recommendations, content entry points |
| Device | `device_tab_screen.dart` | Device status (live battery via MQTT), settings, quiet hours |
| Cards | `analytics_screen.dart` | Usage analytics (daily/weekly/monthly), progress, sessions |
| Profile | `parent_profile.dart` | Parent info, kids, characters, legal, sign-out |

Named routes live in `lib/routes/routes.dart`.

## Key Features

### Onboarding & Auth

Splash → walkthrough → Google/Apple sign-in (`auth_service.dart`) → parent profile setup (with consent collection) → interactive kids onboarding wizard. Backend onboarding state is tracked via `/toy/api/mobile/user-state`. All subsequent API calls attach `Authorization: Bearer <Firebase ID token>`.

### Device provisioning (BLE-first)

Provisioning is coordinated by `provisioning_coordinator.dart`:

1. **BLE (primary):** the app connects to the toy over Bluetooth using ESP BluFi (`ble_provisioning_service.dart`) and transfers Wi-Fi credentials without leaving the home network.
2. **SoftAP (fallback):** the toy broadcasts a `CheekoAI` access point; the app connects (`wifi_connection_service.dart`), calls `GET http://192.168.4.1/scan`, posts `{ssid, password}` to `/submit`, then `/reboot`.

### Device binding & activation

`toy_activation_screen.dart` + `toy_activation_controller.dart`: the parent enters an **activation code** (pinput) or scans a **QR code** (mobile_scanner). Codes are checked via `/api/mobile/activation/check-code` / `validate`, and the device is bound to an agent via `POST /toy/api/mobile/agents/{agentId}/bind/{deviceCode}`. Kid assignment uses `/toy/api/mobile/devices/assign-kid-by-mac`.

### Agent / character management

`character_management_screen.dart` and `agent_details_screen.dart` manage agents (AI character configurations): CRUD via `/toy/api/mobile/agents*`, persona selection via `GET/POST /toy/agent/device/{mac}/current-character` and `/set-character`, role templates via `/agent/template`, and **voice-print enrollment** via `/agent/voice-print/list/{agentId}`, `POST /agent/voice-print`, `DELETE /agent/voice-print/{id}`.

### Device settings & parental controls

`device_settings_screen.dart` / `device_settings_service.dart`: quiet hours, notification settings, autoplay toggle, and other per-device settings via `GET/PATCH /toy/api/mobile/devices/{mac}/settings`. Settings changes are pushed to the device by the backend (Manager API → gateway `:8091` → MQTT `settings_update`), and the app reads acknowledged state via `/devices/{mac}/state` and `/devices/{mac}/sync-events`.

### Chat history

`chat_history_screen.dart`, `chat_message_detail_screen.dart`, `today_interactions_chat_screen.dart`: sessions per agent via `/toy/api/mobile/agents/{id}/sessions`, transcripts via `/agents/{id}/chat-history/{sessionId}`.

### Analytics & progress

`analytics_api_service.dart`: `/toy/analytics/usage/{daily|weekly|monthly}/{mac}`, `/toy/analytics/user-progress/{mac}`, `/toy/analytics/user/{mac}/overall`, `/toy/analytics/sessions/{mac}`, `/toy/analytics/attempts/stats/{mac}`. Home-tab summaries come from `/homepage-activity`, `/progress/summary`, `/progress/trend`, `/homepage-recommendations`.

### Content library

`music_library_screen.dart` + `content_library_service.dart`: `/toy/content/library`, `/library/search`, `/library/categories`. Playing a track sends an MQTT `function_call` to the toy.

### Kids & profile

Kids CRUD and active-kid switching (`/toy/api/mobile/kids`, `/active-kid`, `/switch-active-kid`), parent profile + FCM token registration (`/parent-profile`, `/parent-profile/fcm-token`), account deletion (`/account`).

## Device Remote Control (MQTT)

The app is a remote control, not a device: it fetches MQTT credentials from `POST /toy/ota/`, connects to the EMQX broker (MQTT 3.1.1), and:

| Direction | Topic | Payload |
|---|---|---|
| Subscribe | `app/p2p/{mac}` | `playback_status`, `mcp_response` (battery), `device_status` |
| Publish | `devices/{mac}/data` | `function_call`: `self_volume_up` / `self_volume_down` / `self_get_battery_status` (handled on-device via MCP) |
| Publish | `device-server` | `function_call`: `play_music` / `play_story` / `stop_audio` (routed by the gateway to the active voice session) |

All commands carry `"source": "mobile_app"`. Service: `device_command_service.dart`.

## Building and Running

```bash
cd CheekoAI-Parent-App
flutter pub get
flutter run           # debug on connected device
flutter build apk     # Android release
flutter build ios     # iOS release
```

Requirements: `google-services.json` (Android) / `GoogleService-Info.plist` (iOS), Apple Sign-In capability, Bluetooth + location permissions for BLE provisioning, `NEHotspotConfiguration` entitlement for the SoftAP fallback. Copy `.env.example` → `.env` with the API base URLs. Shorebird handles over-the-air Dart patches (`shorebird.yaml`).
