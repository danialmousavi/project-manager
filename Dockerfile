FROM docker-mirror.liara.ir/node:24-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
# Keep the lockfile resolver consistent with the npm version used to create it.
RUN npm config set registry https://package-mirror.liara.ir/repository/npm/ --global \
  && npm config set replace-registry-host always --global \
  && npm install --global npm@11.1.0 \
  && npm ci --no-audit --no-fund

FROM deps AS migrator

COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate --config prisma7.config.ts
CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

FROM deps AS seed

COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY scripts ./scripts
COPY lib/password.ts ./lib/password.ts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate --config prisma7.config.ts
CMD ["npm", "run", "db:seed"]

FROM deps AS deadline

COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY scripts ./scripts
COPY lib/prisma.ts ./lib/prisma.ts
COPY lib/notifications.ts ./lib/notifications.ts
COPY lib/task-deadline-notifications.ts ./lib/task-deadline-notifications.ts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate --config prisma7.config.ts
CMD ["npm", "run", "notifications:deadlines"]

FROM deps AS builder

COPY . .

# Prisma 7 reads DATABASE_URL through prisma7.config.ts during generation.
ENV DATABASE_URL=postgresql://project_user:local_dev_password@postgres:5432/project_manager?schema=public
RUN npx prisma generate --config prisma7.config.ts
RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs -g 1001 \
  && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/generated ./generated

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
