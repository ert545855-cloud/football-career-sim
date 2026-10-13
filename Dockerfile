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
# Çalışma zamanı bağımlılıkları (yalnızca pg; vite gibi geliştirme paketleri kurulmaz)
COPY web/package.json web/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY web/server.mjs ./server.mjs
COPY web/server ./server
USER node
EXPOSE 10000
CMD ["node", "server.mjs"]
