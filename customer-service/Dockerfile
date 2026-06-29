FROM node:18-alpine
WORKDIR /app/customer-service
COPY customer-service/package*.json ./
RUN npm install --omit=dev
COPY shared/ ./shared/
COPY customer-service/ .
EXPOSE 3003
CMD ["node", "server.js"]
