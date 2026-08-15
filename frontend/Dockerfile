FROM node:20-alpine

WORKDIR /app

# Use the image's non-root `node` user
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
