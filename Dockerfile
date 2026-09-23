FROM docker.io/oven/bun:1

WORKDIR /app

# deps first for cache
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 3000 5173

# api by default, web container overrides this
CMD ["bun", "run", "src/server/index.ts"]
