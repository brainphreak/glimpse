FROM node:24-alpine AS base

# Build stage
FROM base AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM base AS runner
RUN apk add --no-cache python3 make g++ bash tmux
RUN npm install -g @anthropic-ai/claude-code
# tmux config: no status bar, correct terminal type for Claude's TUI
RUN printf 'set -g status off\nset -g default-terminal "xterm-256color"\nset -ga terminal-overrides ",xterm-256color:Tc"\n' > /root/.tmux.conf
WORKDIR /app
ENV NODE_ENV=production

# Copy built app and dependencies
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./server.js
# Note: .env.local is NOT baked into the image. Provide config at runtime via
# docker-compose `env_file: .env.local` (or `-e` flags / a secrets manager).

RUN mkdir -p /data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
