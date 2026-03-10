# Stage 1: Build the React application
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time arguments for Vite environment variables
ARG VITE_API_URL=/api
ARG VITE_CLI_API_URL=/cli-api

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CLI_API_URL=$VITE_CLI_API_URL

# Copy package configuration files
COPY package.json package-lock.json ./

# Install dependencies with increased timeout to prevent socket issues
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:alpine

# Copy the built static content from the builder stage to the Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy documentation folder
COPY devinfo /usr/share/nginx/html/devinfo

# Expose port 80 to the outside world
EXPOSE 80

# Command to run Nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]
