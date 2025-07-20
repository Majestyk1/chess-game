FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production --silent

# Copy application source
COPY . .

# Expose the port the app runs on
ENV PORT 3000
EXPOSE 3000

# Start the server
CMD ["npm", "start"] 