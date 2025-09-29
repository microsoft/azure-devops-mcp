# Use official Node.js LTS image as base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy rest of the source code
COPY . .

# Build the project (if needed)
RUN npm run build || true

# Expose port (change if MCP server uses a different port)
EXPOSE 3000

# Start MCP server
CMD ["npm", "start"]
