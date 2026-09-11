# --- Stage 3: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 5000

CMD ["npm", "run", "start"]
