FROM node:18-alpine
WORKDIR /app/api-gateway
COPY api-gateway/package*.json ./
RUN npm install --omit=dev
COPY shared/ ./shared/
COPY api-gateway/ .
EXPOSE 3000
CMD ["node", "server.js"]
