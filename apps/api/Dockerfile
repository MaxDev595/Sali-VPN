FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm install --workspace=@sali/types --workspace=@sali/api

FROM deps AS build
COPY packages/types packages/types
COPY apps/api apps/api
RUN npm run build --workspace=@sali/types
RUN npm run --workspace=@sali/api prisma:generate
RUN npm run build --workspace=@sali/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/types ./packages/types
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
