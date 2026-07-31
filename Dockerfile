# Ledgerly — single-process image serving the built SPA and the API.
FROM node:22-slim

# better-sqlite3 ships prebuilt binaries for most platforms, but keep the
# toolchain available so it can compile from source if none matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
# Mount a persistent volume here so the SQLite database survives redeploys.
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 4000
CMD ["npm", "run", "start"]
