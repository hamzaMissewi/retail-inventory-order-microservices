FROM node:18-alpine
WORKDIR /app/notification-service
COPY notification-service/package*.json ./
RUN npm install --omit=dev
COPY shared/ ./shared/
COPY notification-service/ .
EXPOSE 3004
CMD ["node", "server.js"]
