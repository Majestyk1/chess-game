FROM node:20-alpine

# 1. App directory
WORKDIR /app

# 2. Install ALL dependencies (incl. devDeps needed for the build)
COPY package*.json ./
RUN npm install --silent

# 3. Copy source and run the build once
COPY . .
RUN npm run build      # generates public/script.dist.js

# 4. Expose and start
ENV PORT 3000
EXPOSE 3000
CMD ["node", "server.js"]