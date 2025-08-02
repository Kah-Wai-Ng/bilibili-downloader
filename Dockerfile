# Use Node.js LTS version with Alpine for smaller image size
FROM node:18-alpine

# Install FFmpeg and other required system packages
RUN apk add --no-cache \
    ffmpeg \
    wget \
    curl \
    bash

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY . .

# Create necessary directories
RUN mkdir -p downloads temp

# Set appropriate permissions
RUN chmod +x server.js

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S downloader -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R downloader:nodejs /app

# Switch to non-root user
USER downloader

# Start the application
CMD ["node", "server.js"]