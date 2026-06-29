FROM node:18-alpine
WORKDIR /app/product-service
COPY product-service/package*.json ./
RUN npm install --omit=dev
COPY shared/ ./shared/
COPY product-service/ .
EXPOSE 3001
CMD ["node", "server.js"]
