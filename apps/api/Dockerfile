# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/kurukin-video-player-pkg/package.json packages/kurukin-video-player-pkg/package.json
COPY packages/shared/mail/package.json packages/shared/mail/package.json
RUN pnpm install --no-frozen-lockfile --ignore-scripts

FROM deps AS builder
COPY . .
RUN pnpm --filter @leadflow/api build

FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /workspace
EXPOSE 3001
CMD ["pnpm", "--filter", "@leadflow/api", "dev"]

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=builder /workspace/packages/shared/mail/package.json ./packages/shared/mail/package.json
COPY --from=builder /workspace/packages/shared/mail/node_modules ./packages/shared/mail/node_modules
COPY --from=builder /workspace/packages/shared/mail/dist ./packages/shared/mail/dist
WORKDIR /app/apps/api
COPY --from=builder /workspace/apps/api/dist/. ./dist/
RUN ls -R ./dist
RUN test -f ./dist/apps/api/src/main.js
EXPOSE 3001
CMD ["node", "dist/apps/api/src/main.js"]
