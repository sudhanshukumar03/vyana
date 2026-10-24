FROM node:24.22.1-bookworm-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@11.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY shared/package.json shared/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY shared shared
RUN pnpm --filter @healthguard/api build && pnpm --filter @healthguard/api deploy --prod /runtime
FROM node:24.22.1-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0
COPY --from=build --chown=node:node /runtime ./
USER node
EXPOSE 8000
CMD ["node", "dist/index.js"]
