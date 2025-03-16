# Use the official Node.js 16 image as the base image.
FROM node:16

# Create and set the working directory.
WORKDIR /usr/src/app

# Copy package files and install dependencies.
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the application code.
COPY . .

# Expose port 8080.
EXPOSE 8080

# Start the application.
CMD [ "node", "index.js" ]
