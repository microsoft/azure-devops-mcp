# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# Build and run Azure DevOps MCP Server over HTTP for Azure Container Apps.

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# Production image
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Default: run HTTP server with envvar auth. Override CMD to pass your org and options.
# Example: CMD ["node", "dist/http.js", "myorg", "--domains", "all", "--authentication", "envvar"]
CMD ["node", "dist/http.js", "dcslsoftwareltd", "--domains", "all", "--authentication", "envvar"]
