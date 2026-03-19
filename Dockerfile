FROM node:20-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    dumb-init \
    openssl \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN cp /app/.env.docker /app/.env \
  && chmod +x /app/docker/app/entrypoint.sh \
  && mkdir -p /app/public/uploads/branding /app/public/logos \
  && SKIP_DB_DURING_BUILD=true npm run build

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "/app/docker/app/entrypoint.sh"]
