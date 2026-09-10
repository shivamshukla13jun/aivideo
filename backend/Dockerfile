# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools if required
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests and production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled code from builder stage
COPY --from=builder /app/dist ./dist

# Create storage directories
RUN mkdir -p /app/storage/uploads /app/storage/videos

EXPOSE 5000

CMD ["node", "dist/server.js"]
