FROM node:20-alpine

WORKDIR /app

# Install dependencies (including dev dependencies for TypeScript build)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build (optional - saves space)
RUN npm prune --production

# Expose port
EXPOSE 3001

# Health check (PORT env var is provided by Render)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/index.js"]

