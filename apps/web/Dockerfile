# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS builder
ARG NEXT_PUBLIC_APP_BASE_DOMAIN=leadflow.kurukin.com
ARG NEXT_PUBLIC_API_URL=https://api.leadflow.kurukin.com
ENV NEXT_PUBLIC_APP_BASE_DOMAIN=$NEXT_PUBLIC_APP_BASE_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm --filter @leadflow/web build

FROM deps AS dev
ENV NODE_ENV=development
WORKDIR /workspace
EXPOSE 3000
CMD ["pnpm", "--filter", "@leadflow/web", "dev"]

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ARG NEXT_PUBLIC_APP_BASE_DOMAIN=leadflow.kurukin.com
ARG NEXT_PUBLIC_API_URL=https://api.leadflow.kurukin.com
ENV NEXT_PUBLIC_APP_BASE_DOMAIN=$NEXT_PUBLIC_APP_BASE_DOMAIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /workspace/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
