FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json ./
COPY apps/bot/package.json apps/bot/package.json
RUN npm install --workspace=@sali/bot

FROM deps AS build
COPY apps/bot apps/bot
RUN npm run build --workspace=@sali/bot

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/bot/dist ./apps/bot/dist
COPY --from=build /repo/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=build /repo/apps/bot/package.json ./apps/bot/package.json

WORKDIR /repo/apps/bot
EXPOSE 8080
CMD ["node", "dist/index.js"]
