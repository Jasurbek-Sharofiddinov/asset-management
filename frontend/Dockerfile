# Keep the Node major in sync with the build stage of Dockerfile.prod so a dev
# run and a production build resolve the same toolchain.
FROM node:22-alpine

WORKDIR /app

# Use the image's non-root `node` user
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci
COPY --chown=node:node . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
