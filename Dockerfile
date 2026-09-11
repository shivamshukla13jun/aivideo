# syntax=docker/dockerfile:1
# ==============================================================================
# 🎬 AI Video Studio: Single Web Service (Frontend SPA + Backend API)
# ==============================================================================

# --- Stage 1: Build React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:20-alpine AS backend-builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build:backend

# --- Stage 3: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/storage/uploads /app/storage/videos /app/storage/memory

EXPOSE 5000

CMD ["node", "dist/server.js"]
