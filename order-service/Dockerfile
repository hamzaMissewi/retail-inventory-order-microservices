FROM node:18-alpine
WORKDIR /app/order-service
COPY order-service/package*.json ./
RUN npm install --omit=dev
COPY shared/ ./shared/
COPY order-service/ .
EXPOSE 3002
CMD ["node", "server.js"]
