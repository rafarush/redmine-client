# Imagen de la versión web: SPA + proxy Nitro (preset node-server)
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
