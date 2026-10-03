# Movie Ticket Platform — React + Node.js + PostgreSQL + Docker + EKS

A complete three-tier movie ticket booking application intended for local Docker Compose use and deployment to Amazon EKS.

## Architecture

```text
                    Internet / Browser
                           |
                           v
                AWS Application Load Balancer
                           |
                           v
             +-----------------------------+
             | Web Tier                    |
             | React + Nginx               |
             | frontend Deployment (2)     |
             +-----------------------------+
                           |
                    ClusterIP service
                           |
                           v
             +-----------------------------+
             | Application Tier            |
             | Node.js + Express           |
             | backend Deployment (2)      |
             +-----------------------------+
                           |
                    ClusterIP service
                           |
                           v
             +-----------------------------+
             | Data Tier                   |
             | PostgreSQL StatefulSet (1)  |
             | Persistent EBS volume       |
             +-----------------------------+
```

The Nginx web tier proxies `/api/*` to the internal `backend-service`. PostgreSQL is never exposed outside the cluster.

The booking endpoint runs inside a PostgreSQL transaction, locks the show row, verifies all selected seats are available, marks them `BOOKED`, and creates the booking. This prevents two concurrent requests from successfully reserving the same seat.

## Project structure

```text
movie-ticket-platform/
├── frontend/
│   ├── Dockerfile
│   ├── .env.development
│   ├── .env.production
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── styles.css
│       ├── api/client.js
│       └── components/
│           ├── MovieList.jsx
│           ├── SeatSelection.jsx
│           └── BookingConfirmation.jsx
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   ├── db/
│   │   ├── pool.js
│   │   └── migrate.js
│   └── routes/
│       ├── movies.js
│       ├── shows.js
│       └── bookings.js
├── k8s/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── postgres-statefulset.yaml
│   ├── postgres-service.yaml
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── ingress.yaml
│   ├── network-policies.yaml
│   └── kustomization.yaml
├── docker-compose.yml
└── README.md
```

## Run locally with Docker Compose

From the project root:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

The API is also reachable directly for debugging at:

```text
http://localhost:4000/api/health
```

To stop the stack:

```bash
docker compose down
```

To remove the database volume as well:

```bash
docker compose down -v
```

## Run the frontend and backend without containers

Start PostgreSQL separately, then:

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## API

```text
GET  /api/health
GET  /api/movies
GET  /api/movies/:movieId/shows
GET  /api/shows/:showId/seats
POST /api/bookings
GET  /api/bookings/:bookingCode
```

Example booking request:

```json
{
  "show_id": 1,
  "seat_ids": [1, 2, 3],
  "customer_name": "Sandeep Sunny",
  "customer_email": "sandeep@example.com"
}
```

## Build the Docker images

```bash
docker build -t movie-ticket-backend:1.0.0 ./backend
docker build -t movie-ticket-frontend:1.0.0 ./frontend
```

## Deploy to Amazon EKS

### Prerequisites

You should have:

1. An existing EKS cluster and working `kubectl` access.
2. The AWS Load Balancer Controller installed and able to create ALBs.
3. The Amazon EBS CSI driver installed if your cluster does not already provide a `gp3` StorageClass.
4. ECR repositories available for the two images.
5. Worker node/pod IAM permissions that allow pulling from ECR.

The ingress is written for the AWS Load Balancer Controller with an internet-facing ALB. EKS documents that the controller creates an ALB from a Kubernetes Ingress and supports `target-type: ip`; this project keeps the ALB in front of only the web tier. See the official EKS load-balancer documentation before production rollout.

### Create ECR repositories

For `ap-south-1`:

```bash
aws ecr create-repository --repository-name movie-ticket-backend --region ap-south-1
aws ecr create-repository --repository-name movie-ticket-frontend --region ap-south-1
```

### Authenticate Docker to ECR

```bash
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com
```

### Build, tag, and push

```bash
docker build -t movie-ticket-backend:1.0.0 ./backend
docker build -t movie-ticket-frontend:1.0.0 ./frontend

docker tag movie-ticket-backend:1.0.0 \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/movie-ticket-backend:1.0.0

docker tag movie-ticket-frontend:1.0.0 \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/movie-ticket-frontend:1.0.0

docker push \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/movie-ticket-backend:1.0.0

docker push \
  YOUR_AWS_ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/movie-ticket-frontend:1.0.0
```

### Set the database secret

Before applying Kubernetes manifests, edit `k8s/secrets.yaml` and replace:

```text
CHANGE_ME_IN_REAL_ENVIRONMENTS
```

For a real environment, store database credentials in AWS Secrets Manager / Parameter Store and synchronize them into Kubernetes with your chosen secrets integration rather than committing credentials to Git.

### Deploy

Because this repository contains a kustomization, the simplest command is:

```bash
kubectl apply -k k8s/
```

Watch the rollout:

```bash
kubectl get pods -n movie-platform -w
```

Check services:

```bash
kubectl get svc -n movie-platform
```

Check the ALB Ingress:

```bash
kubectl get ingress -n movie-platform
```

The ALB hostname appears under `ADDRESS`. Open that hostname after the ingress becomes ready.

### Verify the application tier

```bash
kubectl exec -n movie-platform deploy/backend -- \
  node -e "fetch('http://127.0.0.1:4000/api/health').then(async r=>{console.log(r.status); console.log(await r.text())})"
```

### Useful troubleshooting commands

```bash
kubectl get all -n movie-platform
kubectl describe ingress movie-platform-ingress -n movie-platform
kubectl logs -n movie-platform deploy/backend
kubectl logs -n movie-platform deploy/frontend
kubectl logs -n movie-platform statefulset/postgres
kubectl get events -n movie-platform --sort-by=.lastTimestamp
kubectl get pvc -n movie-platform
```

If the PostgreSQL PVC stays `Pending`, verify that a `gp3` StorageClass and the EBS CSI driver are available in your cluster.

If the ingress has no ALB address, verify the AWS Load Balancer Controller and its IAM configuration, plus the required subnet tags/discovery configuration for your cluster.

## Production hardening ideas

This demo deliberately keeps the core platform easy to understand. Before using it as a real ticketing service, add authentication/authorization, HTTPS with an ACM certificate, a managed PostgreSQL service such as Amazon RDS/Aurora, automated backups, secret management, structured logs, distributed tracing/metrics, a proper payment workflow, idempotency keys, seat-hold expiry, audit logging, and horizontal autoscaling.

## Important implementation notes

- PostgreSQL is the source of truth for seat availability.
- The booking transaction uses the same `pg` client for `BEGIN`, row locks, inserts, updates, and `COMMIT`/`ROLLBACK`.
- Backend pods are stateless and can scale horizontally.
- Frontend pods serve immutable Vite assets through Nginx.
- The database is persistent through a Kubernetes PVC.
