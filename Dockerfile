# Krampon — Render (Docker) için: oyunu derle, küçük bir Node sunucusuyla yayınla.
FROM node:22-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm test && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000
COPY --from=build /app/dist ./dist
COPY web/server.mjs ./server.mjs
USER node
EXPOSE 10000
CMD ["node", "server.mjs"]
