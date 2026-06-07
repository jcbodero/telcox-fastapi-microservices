FROM node:20-alpine AS deps

WORKDIR /app

COPY ui/package*.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_KEYCLOAK_URL=https://reto1.telcox.site/auth
ARG NEXT_PUBLIC_KEYCLOAK_REALM=telcox
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=telcox-web
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_MIXPANEL_TOKEN=

ENV NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL
ENV NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM
ENV NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MIXPANEL_TOKEN=$NEXT_PUBLIC_MIXPANEL_TOKEN

COPY --from=deps /app/node_modules ./node_modules
COPY ui ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

USER node

CMD ["node", "server.js"]
