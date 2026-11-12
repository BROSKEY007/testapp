# Builds the React client and runs the Express server that serves it.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
COPY shared/package.json shared/
RUN npm ci
COPY . .
# "/" makes the client call the API on the same origin it was served from.
# The analog engine (dataset, model) ships inside server/.
ENV NEXT_PUBLIC_API_BASE_URL=/ NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared shared
COPY --from=build /app/server server
COPY --from=build /app/client/out client/out
USER node
EXPOSE 8080
CMD ["node", "server/src/server.js"]
