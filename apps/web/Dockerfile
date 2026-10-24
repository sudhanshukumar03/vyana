FROM node:24.22.1-bookworm-slim AS build
WORKDIR /repo
RUN npm install -g pnpm@11.18.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY shared/package.json shared/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY shared shared
RUN pnpm --dir apps/web build
FROM nginx:stable-alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
