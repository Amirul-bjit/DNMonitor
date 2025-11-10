# Use minimal Node.js Alpine image for Expo
FROM node:20-alpine

# Set environment to development
ENV NODE_ENV=development

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy all application files
COPY . .

# Expose Expo ports
# 8081: Metro bundler
# 8082: Web
# 19000: Expo DevTools
# 19001: Expo Go (Android)
# 19002: Expo Go (iOS)
EXPOSE 8081 8082 19000 19001 19002

# Start Expo with web support
CMD ["npx", "expo", "start", "--web"]
