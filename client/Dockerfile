FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc tsconfig.base.json ./
COPY ["Rules of the Galaxy.md", "./"]
COPY shared ./shared
COPY client ./client
COPY server/package.json ./server/package.json

RUN pnpm install --frozen-lockfile --filter @stellar-dominion/client...

ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
RUN pnpm --filter @stellar-dominion/client run build

FROM caddy:2-alpine
COPY --from=build /app/client/dist /srv
COPY client/Caddyfile /etc/caddy/Caddyfile
