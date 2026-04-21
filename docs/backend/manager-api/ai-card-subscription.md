---
id: ai-card-subscription
sidebar_position: 7
---

# AI Card Subscription

The AI Card subscription system adds prepaid, time-based quota to physical RFID cards with `card_type = "ai"`.

Unlike the older user or device quota models, AI Card quota belongs to the card itself. The monthly usage bucket is keyed by `rfid_uid + month_key`, so every device that taps the same physical card draws from the same time balance.

This feature is implemented on the `aicard_subscription` branch. It adds Manager API endpoints, Supabase migrations, LiveKit worker enforcement, MQTT gateway handling, and admin dashboard controls.

## Product Model

| Item | Behavior |
|---|---|
| Unit of quota | Physical RFID card |
| Quota key | `rfid_uid` + current UTC month, formatted as `YYYY-MM` |
| Quota type | Connected session time, measured in seconds |
| Default card balance | `rfid_card_mapping.monthly_time_limit_secs` |
| Recharge balance | `ai_card_time_quota.extra_purchased` |
| Usage | `ai_card_time_quota.seconds_used` |
| Exhausted state | `seconds_used >= monthly_time_limit_secs + extra_purchased` |
| Sharing behavior | If multiple users tap the same card, they share the same card balance |

The intended model is prepaid: a company can ship a device and AI card bundle with a configured monthly time limit, then parents can recharge the card with extra time.

## Scope

AI Card subscription applies only to RFID cards where:

- `rfid_card_mapping.card_type = "ai"`
- The card is an individual card mapping, not a bulk series mapping
- The card starts an AI prompt/session flow

Other card types continue to use their existing behavior:

- Content cards continue to play/download content.
- Question and pack cards continue to use existing RFID routing.
- Device-level question, token, and time quota APIs remain available for backward compatibility.

### Series and Bulk-Range AI Cards

AI cards resolved through `rfid_series` or bulk UID ranges do not have `monthly_time_limit_secs`. They are treated as unlimited and return quota metadata equivalent to:

```json
{
  "quotaExhausted": false,
  "monthlyTimeLimit": -1,
  "timeUsed": 0,
  "timeRemaining": -1,
  "extraPurchased": 0
}
```

Only individually mapped cards in `rfid_card_mapping` support per-card time quota. To apply time quota to bulk range cards, the schema would need a time-limit field on the series/range model as well.

## UID Normalization

RFID UIDs are normalized before quota lookup and consumption:

- Leading and trailing whitespace is removed.
- Letters are uppercased.
- Separators such as `:` and `-` are removed.
- Non-hex characters are stripped by the Node service.

Examples:

| Raw UID | Normalized UID |
|---|---|
| `ab:cd:12:34` | `ABCD1234` |
| `ab-cd-1234` | `ABCD1234` |
| ` ABCD1234 ` | `ABCD1234` |

Use normalized UIDs in manual tests and support runbooks so API results match device behavior.

## Data Model

### `rfid_card_mapping.monthly_time_limit_secs`

AI cards get a configured monthly time limit on the card mapping row.

| Value | Meaning |
|---|---|
| `0` | Card is not configured. It is blocked unless extra time was granted. |
| Positive integer | Monthly seconds included with the card. |
| `-1` | Unlimited card time. |

### `ai_card_time_quota`

The monthly usage table stores consumed and recharged seconds.

| Column | Purpose |
|---|---|
| `rfid_uid` | Normalized RFID UID for the physical card |
| `month_key` | UTC month in `YYYY-MM` format |
| `seconds_used` | Total connected seconds consumed this month |
| `extra_purchased` | Extra seconds granted by recharge |
| `remaining_seconds` | Cached remaining seconds for app/admin display |
| `status` | `active`, `exhausted`, or `not_configured` |

The table has a unique constraint on `(rfid_uid, month_key)` so the database can atomically update the monthly row.

### RPC Functions

The migrations add atomic PostgreSQL functions:

| Function | Purpose |
|---|---|
| `consume_ai_card_time` | Adds elapsed seconds to the card's current monthly usage |
| `grant_ai_card_extra_time` | Adds extra seconds to the card's current monthly balance |

Both functions use `INSERT ... ON CONFLICT` so concurrent sessions on the same card add to the same row without lost updates.

## Runtime Flow

### Card Tap

1. Firmware sends an RFID lookup request through the MQTT gateway.
2. MQTT gateway calls Manager API RFID lookup.
3. Manager API detects `card_type = "ai"`.
4. Manager API checks the card's time quota.
5. If exhausted, MQTT gateway sends `time_quota_exhausted` to the device and no LiveKit session starts.
6. If configured and not exhausted, MQTT gateway forwards the card prompt and `rfid_uid` to the LiveKit worker.
7. LiveKit calls the AI card quota endpoint and starts time tracking for that card.

### Active Session

1. `QuotaManager` starts a background time tracker.
2. Every 30 seconds it reports elapsed time to Manager API.
3. Manager API updates `ai_card_time_quota` through the atomic RPC.
4. The worker updates local remaining time from the API response.
5. If remaining time reaches zero, the worker stops the session and asks Manager API to publish the MQTT exhaust message.

### Recharge

1. Parent or admin selects an AI card.
2. Client calls the recharge endpoint with an amount in seconds.
3. Manager API calls `grant_ai_card_extra_time`.
4. The card immediately has more remaining time for the current month.

Recharge currently grants time. Payment checkout, invoices, and payment gateway verification are not part of this branch.

### Discovery

The parent-facing `my-cards` list is discovery-based. A card appears for a parent after the card has been tapped and a tap event exists in `rfid_card_tap_log` for that user context.

Because quota belongs to the card, not the user, the same physical card can appear for multiple users if multiple families or devices tap it. All users see and consume the same shared card balance.

## Manager API Endpoints

All paths are mounted under `/toy`.

### Service-to-Service

These endpoints are used by LiveKit workers and gateway services. They require `X-Service-Key`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/subscription/quota/ai-card/:rfidUid` | Read AI card quota at session start |
| `POST` | `/subscription/consume/ai-card-time/:rfidUid` | Consume elapsed seconds for an active card session |
| `POST` | `/subscription/publish-mqtt-exhaust` | Ask Manager API to publish an exhaustion message to the device |

Example quota response:

```json
{
  "code": 0,
  "msg": "AI card quota retrieved",
  "data": {
    "rfidUid": "ABCD1234",
    "cardName": "Magic Card",
    "cardType": "ai",
    "quotaType": "ai_card_time",
    "remaining": 3000,
    "remainingSeconds": 3000,
    "isExhausted": false,
    "status": "active",
    "limit": 3000,
    "used": 0,
    "extraPurchased": 0,
    "monthKey": "2026-04"
  }
}
```

Consume time request:

```bash
curl -X POST "$BASE_URL/toy/subscription/consume/ai-card-time/ABCD1234" \
  -H "X-Service-Key: $SERVICE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"seconds": 30}'
```

### Parent App

These endpoints require a bearer token.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/subscription/ai-card-status/:rfidUid` | Read one card's status |
| `GET` | `/subscription/my-cards` | List AI cards discovered by the current parent user |
| `POST` | `/subscription/recharge/:rfidUid` | Grant extra seconds to a card |

Recharge request:

```json
{
  "amount": 3600
}
```

The `amount` is seconds. The branch caps a single recharge request at 86,400 seconds, or 24 hours.

Example card status response:

```json
{
  "code": 0,
  "msg": "AI card status retrieved",
  "data": {
    "rfidUid": "ABCD1234",
    "cardName": "Magic Card",
    "notes": "ai",
    "monthlyTimeLimit": 3000,
    "secondsUsed": 900,
    "extraPurchased": 600,
    "remaining": 2700,
    "remainingSeconds": 2700,
    "isExhausted": false,
    "monthKey": "2026-04"
  }
}
```

Example `my-cards` response shape:

```json
{
  "code": 0,
  "msg": "My cards retrieved",
  "data": {
    "cards": [
      {
        "rfidUid": "ABCD1234",
        "cardName": "Magic Card",
        "monthlyTimeLimit": 3000,
        "secondsUsed": 900,
        "extraPurchased": 600,
        "remainingSeconds": 2700,
        "status": "active",
        "isExhausted": false,
        "monthKey": "2026-04",
        "lastTapped": "2026-04-21T10:30:00.000Z"
      }
    ]
  }
}
```

### Admin Dashboard

These endpoints require admin authentication.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/subscription/ai-cards/summary` | Paginated list of all AI cards and time usage |
| `GET` | `/subscription/ai-cards/linked` | AI cards linked to users/devices through tap logs |
| `GET` | `/subscription/ai-card-analytics` | Usage summary, top cards, exhausted cards, near-limit cards |
| `GET` | `/subscription/ai-card-quota-settings` | Read AI card quota fail mode |
| `PUT` | `/subscription/ai-card-quota-settings` | Update AI card quota fail mode |

Example linked cards response shape:

```json
{
  "code": 0,
  "msg": "Linked AI cards retrieved",
  "data": {
    "cards": [
      {
        "rfidUid": "ABCD1234",
        "cardName": "Magic Card",
        "userId": 123,
        "macAddress": "AA:BB:CC:DD:EE:FF",
        "monthlyTimeLimit": 3000,
        "secondsUsed": 900,
        "extraPurchased": 600,
        "remainingSeconds": 2700,
        "status": "active",
        "isExhausted": false,
        "lastTapped": "2026-04-21T10:30:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "monthKey": "2026-04"
  }
}
```

Example analytics response shape:

```json
{
  "code": 0,
  "msg": "AI card analytics retrieved",
  "data": {
    "monthKey": "2026-04",
    "totalActiveCards": 42,
    "exhaustedCount": 5,
    "nearExhaustion": [
      {
        "rfidUid": "ABCD1234",
        "cardName": "Magic Card",
        "secondsUsed": 2700,
        "totalAllowed": 3000,
        "remainingSeconds": 300,
        "pctUsed": 90
      }
    ],
    "topCards": [
      {
        "rfidUid": "ABCD1234",
        "cardName": "Magic Card",
        "secondsUsed": 2700,
        "extraPurchased": 0,
        "monthlyTimeLimit": 3000,
        "pctUsed": 90
      }
    ]
  }
}
```

## Fail Mode

AI Card quota supports two failure behaviors when Manager API or quota storage is unreachable.

| Mode | Behavior |
|---|---|
| `open` | Allow the session with unlimited local quota. This is the default child-safe behavior. |
| `capped` | Allow a local emergency cap, then stop the session if the API does not recover. |

The mode is stored in `sys_params.ai_card_quota_fail_mode`.

In capped mode, the LiveKit quota manager uses a 10-minute local cap. If the Manager API remains unreachable after that local cap is consumed, the worker treats the card as exhausted and triggers the same shutdown/exhaustion behavior.

## MQTT Messages

### `time_quota_exhausted`

Sent when a card is already exhausted at tap time or becomes exhausted mid-session.

```json
{
  "type": "time_quota_exhausted",
  "rfid_uid": "ABCD1234",
  "card_name": "Magic Card",
  "message": "Time quota exhausted for this month. Please recharge.",
  "audio_prompt": "recharge_required"
}
```

### `card_not_configured`

Sent when an individual AI card has `monthly_time_limit_secs = 0` and no extra time.

```json
{
  "type": "card_not_configured",
  "rfid_uid": "ABCD1234",
  "card_name": "Magic Card",
  "message": "This card is not yet configured. Please contact support.",
  "audio_prompt": "card_not_configured"
}
```

## LiveKit Integration

The LiveKit worker uses `src/utils/quota_manager.py` to enforce quota.

Important behavior:

- `set_ai_card_context(rfid_uid)` switches quota tracking from device quota to card quota.
- `start_time_tracker()` starts the 30-second background reporting loop.
- `stop_time_tracker()` reports final elapsed seconds when a session ends.
- If quota expires mid-session, the worker speaks the limit message, closes the room, and triggers the MQTT exhaust flow.

Game workers also use the quota manager for device-level quota, but the AI Card flow is mainly tied to prompt/session cards forwarded with `rfid_uid`.

## Admin Dashboard

The `aicard_subscription` branch adds a `Quota Settings` screen.

The screen covers:

- Default quota system for non-subscribed users: question, token, or time.
- Free-tier question/token/time limits.
- Subscription plan overview.
- AI Card fail mode.
- AI cards linked to users/devices.
- AI card usage analytics.
- AI card recharge dialog.

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `SERVICE_SECRET_KEY` | Manager API, LiveKit, gateway | Service-to-service auth for quota endpoints |
| `SUPABASE_URL` | Manager API | Supabase project URL for quota tables/RPCs |
| `SUPABASE_SERVICE_ROLE_KEY` | Manager API | Service-role access for quota RPCs |
| `MANAGER_API_URL` | LiveKit, gateway | Manager API base URL |
| `MANAGER_API_SECRET` | LiveKit, gateway | Service key sent as `X-Service-Key` |
| `MQTT_GATEWAY_URL` | Manager API | Gateway HTTP base URL used by `/subscription/publish-mqtt-exhaust` |
| `MQTT_GATEWAY_SECRET` | Manager API | Optional service key sent to the gateway publish endpoint |

## Gateway Publish Behavior

When an AI card expires mid-session, the LiveKit worker does not publish MQTT directly. It calls:

```http
POST /toy/subscription/publish-mqtt-exhaust
X-Service-Key: <service-secret>
```

The Manager API then calls the MQTT gateway HTTP publish endpoint:

```http
POST {MQTT_GATEWAY_URL}/publish
X-Service-Key: <MQTT_GATEWAY_SECRET>
```

The downstream MQTT topic is:

```text
devices/p2p/{normalizedMac}
```

where `normalizedMac` is lowercased and colon characters are replaced with underscores by the Manager API route.

## Quota Warnings

The LiveKit quota manager can warn the child before quota is exhausted.

| Quota type | Warning threshold |
|---|---|
| Question | 3 questions remaining |
| Token | 10% of limit remaining |
| Time | 5 minutes remaining |

For AI Card time sessions, the worker can instruct the model to briefly tell the child how many minutes of playtime remain, then continue the conversation normally.

## Time Reporting and Retry Behavior

The LiveKit worker reports connected time in deltas, not cumulative totals.

- Time is reported every 30 seconds during an active time-tracked session.
- `stop_time_tracker()` reports any final unreported seconds when the room ends or the participant disconnects.
- Time consumption calls retry with short backoff before giving up.
- If the API is unreachable after retries, the worker keeps using local state according to the configured fail mode.
- The RPC is additive. If the exact same delta is sent twice, it double-consumes. The client mitigates this by tracking the total seconds already reported and sending only new deltas.

## Edge Cases

| Case | Expected behavior |
|---|---|
| Card exhausted at tap | RFID lookup returns exhausted quota metadata. Gateway sends `time_quota_exhausted`; no LiveKit session starts. |
| Card expires mid-session | Worker reports final time, speaks the limit message, closes the session, and triggers MQTT exhaustion. |
| Recharge during active session | Next successful time tick sees the increased `extra_purchased` value and the session can continue if remaining time is now positive. |
| `monthly_time_limit_secs = 0` | Individual card is treated as unconfigured. It is blocked unless it has extra purchased time. |
| Admin changes monthly limit mid-month | Existing `seconds_used` stays. Remaining time becomes `new_limit + extra_purchased - seconds_used`. If the new limit is below used time, the card becomes exhausted. |
| Same card used by two devices | Both sessions consume from the same card/month row. Usage burns down faster because quota is per card, not per session. |
| Card is given to another family | The new user can discover the card by tapping it. Previous users may still see it because discovery history is tap-log based. Quota follows the card. |
| Device disconnects | Worker attempts to report final elapsed seconds. If the API is unreachable, those final seconds may be lost. |
| Duplicate retry payload | Additive RPCs can double-consume if the same delta is submitted twice. Investigate worker delta tracking when debugging this. |

## Verification Checklist

1. Apply the AI Card migrations.
2. Confirm `rfid_card_mapping.monthly_time_limit_secs` exists.
3. Confirm `ai_card_time_quota` exists with unique `(rfid_uid, month_key)`.
4. Confirm `consume_ai_card_time` and `grant_ai_card_extra_time` exist.
5. Seed or configure an AI card with `card_type = "ai"` and a positive `monthly_time_limit_secs`.
6. Call `GET /toy/subscription/quota/ai-card/:rfidUid` with `X-Service-Key`.
7. Consume time through `POST /toy/subscription/consume/ai-card-time/:rfidUid`.
8. Recharge through `POST /toy/subscription/recharge/:rfidUid`.
9. Tap the card through MQTT and verify exhausted cards produce `time_quota_exhausted`.

## Manual API Checks

Set local variables:

```bash
BASE_URL="http://localhost:8002/toy"
SERVICE_KEY="your-service-secret-key"
PARENT_TOKEN="your-parent-token"
ADMIN_TOKEN="your-admin-token"
```

Verify migration objects:

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'ai_card_time_quota';

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'rfid_card_mapping'
  AND column_name = 'monthly_time_limit_secs';

SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%ai_card%';
```

Seed a simple test card:

```sql
INSERT INTO rfid_card_mapping (rfid_uid, card_type, notes, monthly_time_limit_secs, active)
VALUES ('ABCD1234', 'ai', 'Test Magic Card', 300, true)
ON CONFLICT (rfid_uid) DO UPDATE
SET monthly_time_limit_secs = 300,
    card_type = 'ai',
    active = true;
```

Read quota:

```bash
curl -s "$BASE_URL/subscription/quota/ai-card/ABCD1234" \
  -H "X-Service-Key: $SERVICE_KEY"
```

Consume time:

```bash
curl -s -X POST "$BASE_URL/subscription/consume/ai-card-time/ABCD1234" \
  -H "X-Service-Key: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"seconds": 30}'
```

Recharge:

```bash
curl -s -X POST "$BASE_URL/subscription/recharge/ABCD1234" \
  -H "Authorization: Bearer $PARENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 3600}'
```

Admin analytics:

```bash
curl -s "$BASE_URL/subscription/ai-card-analytics" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Publish an exhaustion message through the Manager API to MQTT gateway:

```bash
curl -s -X POST "$BASE_URL/subscription/publish-mqtt-exhaust" \
  -H "X-Service-Key: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"macAddress":"AA:BB:CC:DD:EE:FF","rfidUid":"ABCD1234","cardName":"Test Magic Card"}'
```

## Known Implementation Notes

- The feature is not a payment processor integration yet. Recharge grants time but does not verify Razorpay or Stripe payment.
- The implementation uses Prisma/DigitalOcean PostgreSQL for card metadata and Supabase RPCs for quota usage.
- The `aicard_subscription` branch also contains unrelated memory/OpenClaw changes. Review those separately before merging the branch.
- The branch testing guide uses permissive integration assertions in some places, so passing tests do not prove every route is production-ready.
- The docs endpoint is `/subscription/publish-mqtt-exhaust`. Older design notes may mention `/quota/publish-mqtt-exhaust`; use the implemented subscription route unless the backend is changed.
