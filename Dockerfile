# ==============================================================================
# Stage 1: Builder - Compile TypeScript and prepare dependencies
# ==============================================================================
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy source code (needed before npm ci because of prepare script)
COPY . .

# Install ALL dependencies (including devDependencies for building)
# The prepare script will run automatically and needs src/ folder
RUN npm ci

# Build is already done by prepare script, but run it again to be sure
RUN npm run build

# ==============================================================================
# Stage 2: Runtime - Minimal production image
# ==============================================================================
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy source files (needed for prepare script)
COPY --from=builder /app/src ./src

# Install ONLY production dependencies (no devDependencies)
# Skip prepare script since we already have the built files
RUN npm ci --omit=dev --ignore-scripts && \
  npm cache clean --force

# Copy built application from builder stage (overwrite if needed)
COPY --from=builder /app/dist ./dist

# Remove src folder (not needed at runtime)
RUN rm -rf ./src

# Set environment variables
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV PORT=3000

# Expose HTTP port
EXPOSE 3000

# Health check (optional but recommended for Azure Container Apps)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
# For POC: hardcoded organization and env authentication
# TODO Phase 4: Make this dynamic per user via OAuth tokens
CMD ["node", "dist/index.js", "nexusinno", "--authentication", "env"]
