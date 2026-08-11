FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm install --workspace=@sali/types --workspace=@sali/web

FROM deps AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY packages/types packages/types
COPY apps/web apps/web
RUN npm run build --workspace=@sali/types
RUN npm run build --workspace=@sali/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY infrastructure/nginx/miniapp.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
