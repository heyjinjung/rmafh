# Frontend build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --no-progress --loglevel=error
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
