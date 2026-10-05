FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
ENV NODE_ENV=production \
    DB_PATH=/app/data/nadwa.db
EXPOSE 3000
CMD ["node", "server.js"]
