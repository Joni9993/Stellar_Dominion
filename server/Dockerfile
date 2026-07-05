FROM node:22-bookworm-slim
RUN corepack enable
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY shared ./shared
COPY server ./server
COPY client/package.json ./client/package.json

RUN pnpm install --frozen-lockfile --filter @stellar-dominion/server...

WORKDIR /app/server
EXPOSE 2567
CMD ["npx", "tsx", "src/index.ts"]
