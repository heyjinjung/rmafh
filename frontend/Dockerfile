# Frontend build
FROM node:18-alpine AS builder
WORKDIR /app
ENV NPM_CONFIG_REGISTRY=https://registry.npmjs.org \
	npm_config_loglevel=error \
	npm_config_progress=false \
	npm_config_fetch_retries=5 \
	npm_config_fetch_retry_mintimeout=10000 \
	npm_config_fetch_retry_maxtimeout=60000
COPY package.json package-lock.json .npmrc* ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime image
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
