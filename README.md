# 🛒 Retail Inventory & Order Management System

A production‑ready microservices application built with **Node.js**, **Docker**, and **Kubernetes**.  
It demonstrates a real‑world retail scenario: keeping product inventory and customer orders in sync across services.

**Key features**:

- Two decoupled microservices (Product & Order)
- Automatic database seeding for quick testing
- Containerized with Docker, orchestrated by Kubernetes
- Cloud‑native configuration (Secrets, ConfigMaps, Ingress)
- Scalable, with health checks and liveness probes

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Running Locally with Docker Compose](#running-locally-with-docker-compose)
- [Deploying to Kubernetes](#deploying-to-kubernetes)
- [API Endpoints](#api-endpoints)
- [Cloud Tools Integration](#cloud-tools-integration)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

---

## 🏗 Architecture

```text
┌─────────────────┐          ┌─────────────────┐
│   Order Service  │ ── REST ──▶  Product Service│
│   (Port 3002)    │          │   (Port 3001)    │
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│  MongoDB (orders)│          │ MongoDB (products)│
└─────────────────┘          └─────────────────┘
```

- The **Product Service** manages the catalog and stock levels.
- The **Order Service** creates orders and deducts stock by calling the Product Service synchronously.
- Each service has its own dedicated MongoDB instance (can be replaced with a shared one or a cloud database).

---

## 💻 Tech Stack

| Layer                | Technology                                 |
| -------------------- | ------------------------------------------ |
| **Backend**          | Node.js, Express.js                        |
| **Database**         | MongoDB (with Mongoose ODM)                |
| **Communication**    | REST (axios)                               |
| **Containerization** | Docker                                     |
| **Orchestration**    | Kubernetes (minikube / cloud clusters)     |
| **Cloud Tools**      | MongoDB Atlas, Docker Hub/GCR/ECR, Ingress |
| **Observability**    | (Optional) Prometheus + Grafana            |

---

## 📁 Project Structure

```text
retail-app/
├── product-service/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── order-service/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── docker-compose.yml
├── k8s/
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── product-deployment.yaml
│   ├── product-service.yaml
│   ├── order-deployment.yaml
│   ├── order-service.yaml
│   └── ingress.yaml
├── .gitignore
└── seed-products.sh                # optional manual seed
```

---

## ✅ Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Node.js](https://nodejs.org/) (v18+) – only needed for local development without Docker
- [kubectl](https://kubernetes.io/docs/tasks/tools/) – for Kubernetes deployment
- (Optional) [Minikube](https://minikube.sigs.k8s.io/docs/start/) for local K8s testing

---

## 🚀 Running Locally with Docker Compose

This is the quickest way to test the system.

1. **Clone the repository** (or create the folder structure as shown above).

2. **Start the services**:

    ```bash
    docker-compose up --build
    ```

    This spins up:
    - Two MongoDB containers (for products and orders)
    - Product service on `http://localhost:3001`
    - Order service on `http://localhost:3002`

3. **Verify everything is running**:

    ```bash
    # Check products (automatically seeded with 3 sample items)
    curl http://localhost:3001/products

    # Create an order (replace <product-id> with a real ID from the list)
    curl -X POST http://localhost:3002/orders \
      -H "Content-Type: application/json" \
      -d '{"productId":"<product-id>","quantity":2}'

    # List all orders
    curl http://localhost:3002/orders
    ```

4. **Stop**:
    ```bash
    docker-compose down -v   # also removes volumes
    ```

---

## ☸️ Deploying to Kubernetes

The `k8s/` folder contains all manifests for a cloud‑ready deployment.

### 1. Build and Push Container Images

```bash
docker build -t <your-registry>/product-service:latest ./product-service
docker build -t <your-registry>/order-service:latest ./order-service
docker push <your-registry>/product-service:latest
docker push <your-registry>/order-service:latest
```

### 2. Update Manifests

- Edit `k8s/product-deployment.yaml` and `k8s/order-deployment.yaml`:
    - Replace `your-registry` with your actual image repository (e.g., `docker.io/username`).
- Edit `k8s/secrets.yaml`:
    - Encode your MongoDB Atlas connection string with `base64` and replace the `uri` value.

### 3. Apply to Cluster

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/
```

### 4. Expose the Services

- If using Minikube, enable the ingress addon:
    ```bash
    minikube addons enable ingress
    ```
- Update `k8s/ingress.yaml` with your actual domain.
- For testing, use port‑forwarding:
    ```bash
    kubectl port-forward service/product-service 3001:3001
    kubectl port-forward service/order-service 3002:3002
    ```

---

## 📡 API Endpoints

### Product Service (`:3001`)

| Method | Endpoint               | Description                    |
| ------ | ---------------------- | ------------------------------ |
| GET    | `/health`              | Health check                   |
| GET    | `/products`            | List all products              |
| GET    | `/products/:id`        | Get a single product by ID     |
| PUT    | `/products/:id/deduct` | Deduct stock (used internally) |
| POST   | `/products`            | (Optional) Add a new product   |

### Order Service (`:3002`)

| Method | Endpoint  | Description                     |
| ------ | --------- | ------------------------------- |
| GET    | `/health` | Health check                    |
| GET    | `/orders` | List all orders                 |
| POST   | `/orders` | Create an order (deducts stock) |

**Example Order Creation**:

```json
{
    "productId": "65a1b2c3d4e5f67890abcd12",
    "quantity": 2
}
```

---

## ☁️ Cloud Tools Integration

The project is designed to be deployed on any Kubernetes cluster and integrates seamlessly with cloud services:

| Tool                     | Usage                                                                  |
| ------------------------ | ---------------------------------------------------------------------- |
| **MongoDB Atlas**        | Replace the `uri` secret with your Atlas connection string.            |
| **Container Registry**   | Docker Hub, Google Container Registry, or AWS ECR – push images there. |
| **Ingress Controller**   | Use cloud‑native load balancers (AWS ALB, GCP HTTP(S) LB, etc.).       |
| **ConfigMaps & Secrets** | Manage environment configuration and credentials securely.             |
| **Monitoring**           | Add Prometheus and Grafana via Helm for metrics and dashboards.        |

---

## 🔧 Environment Variables

Both services accept the following environment variables:

| Variable              | Description                             | Default                                                                                              |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `MONGO_URI`           | MongoDB connection string               | `mongodb://mongo-products:27017/products` (product) or `mongodb://mongo-orders:27017/orders` (order) |
| `PRODUCT_SERVICE_URL` | URL of the Product service (order only) | `http://product-service:3001`                                                                        |
| `PORT`                | HTTP port the service listens on        | `3001` (product), `3002` (order)                                                                     |

---

## 🤝 Contributing

Contributions are welcome!

- Fork the repository.
- Create a feature branch.
- Submit a pull request with a clear description of changes.

---

## 📄 License

This project is open‑source and available under the [MIT License](LICENSE).

---

**Happy building!** 🚀  
If you find this useful, give it a ⭐ on GitHub.
