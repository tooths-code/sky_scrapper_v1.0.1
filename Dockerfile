# Use Node.js 18 as the base image
FROM node:18

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/google-chrome-stable

# Install necessary dependencies
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

# Copy project files to container
COPY . /app

# Set working directory
WORKDIR /app

# Install dependencies
RUN npm install

# Expose port 3000 for web server
EXPOSE 3000

# Start the server
CMD [ "npm", "start" ]
