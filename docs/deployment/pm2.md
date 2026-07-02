---
id: pm2
sidebar_position: 2
---

# Process Management & Deployment

Cheeko services no longer share one PM2 ecosystem. Each service ships its own deployment path:

| Service | How it runs in production |
|---|---|
| **Voice agent (picoclaw-livekit)** | **Kubernetes (EKS)** — `picoclaw/deploy/k8s/` (Deployment, HPA, PDB, PodMonitor), image from `Dockerfile.eks`. See [Voice Agent — Config & Deployment](../backend/voice-agent/config-deployment.md). |
| **mqtt-gateway** | PM2 (`ecosystem.config.js` in the gateway repo) or Docker (`docker-compose.digitalocean.yml`, `deploy-digitalocean.sh`) on a DigitalOcean droplet, alongside the EMQX broker |
| **manager-api-node** | Docker (multi-stage `Dockerfile`, `docker-compose.yml`) or `node server.js` under a process manager; Prisma migrations run automatically at boot |
| **manager-web** | Static `dist/` build served by nginx (`Dockerfile.production`) |
| **admin-dashboard** | `node server.js` (Express, port 4000) |
| **Imagine server (line_art)** | `uvicorn app.main:app --port 8090` on a GPU host; `docker compose up -d speaches comfyui` for local backends |
| **livekit-server (Python)** | **Retired** — no longer deployed; code remains at `main/livekit-server` |

## Gateway PM2 config

The actual `main/mqtt-gateway/ecosystem.config.js` is a single app:

```js
module.exports = {
  apps: [{ name: "xz-mqtt", script: "app.js", time: true }]
};
```

```bash
cd main/mqtt-gateway
pm2 start ecosystem.config.js
pm2 logs xz-mqtt
pm2 restart xz-mqtt
```

A multi-instance PM2 layout (gateway-1..4 with per-instance UDP ports) exists only as a scaling design — see [Scaling](./scaling.md); it is not deployed today.

## Voice agent on Kubernetes

```bash
# Build & push (CGO image with TEN VAD)
docker build -f Dockerfile.eks -t <registry>/picoclaw-livekit .

# Deploy
kubectl apply -f deploy/k8s/livekit-deployment.yaml
kubectl apply -f deploy/k8s/livekit-hpa.yaml
kubectl apply -f deploy/k8s/livekit-pdb.yaml
```

Workers register with LiveKit under `--agent-name` (e.g. `cheeko-agent1`); the HPA scales replicas, each capped at `MaxSessions` (default 100). SIGTERM drains active sessions gracefully, so rolling updates don't cut off conversations.
