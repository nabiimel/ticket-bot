# Shared image for both the bot and the dashboard. The compose file picks the
# command per service.
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/bot/package.json apps/bot/
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci && npm rebuild better-sqlite3

COPY . .

# Build the dashboard ahead of time; the bot runs from source via tsx.
# Secrets aren't needed to build — validation happens at container start.
RUN SKIP_ENV_VALIDATION=1 npm run build --workspace @ticketbot/dashboard

EXPOSE 3000 8787
CMD ["npm", "run", "start:bot"]
