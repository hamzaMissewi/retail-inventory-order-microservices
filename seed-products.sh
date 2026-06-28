#  (optional bash script to add sample data)
#!/bin/bash
# Add this product manually after docker-compose is up
curl -X POST http://localhost:3001/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Gaming Monitor","price":299.99,"stock":15}'