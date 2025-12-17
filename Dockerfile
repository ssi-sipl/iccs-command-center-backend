# backend/Dockerfile - Express on Node 22 Alpine
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# final image
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# non-root user
RUN addgroup -S app && adduser -S -G app app
USER app

COPY --from=builder /app ./

EXPOSE 5000
# Assumes your backend entrypoint is server.js
CMD ["node", "server.js"]
