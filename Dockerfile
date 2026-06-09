FROM node:24-alpine

WORKDIR /app

RUN apk add --no-cache git libc6-compat

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV HOSTNAME=0.0.0.0

RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

EXPOSE 3000 3001 3002 3003

CMD ["pnpm", "dev"]
