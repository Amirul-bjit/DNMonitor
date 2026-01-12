# Docker Monitor System - Complete Setup

## Overview
A comprehensive Docker container monitoring system with 5 mock projects running under the **bjit-network** Docker network, all monitored by a React Native frontend application.

## Architecture

### Monitored Applications (Mock Projects)
1. **Express API** (Node.js/Express) - Port 3000
   - REST API with user management endpoints
   - Health checks every 30 seconds
   
2. **.NET API** (ASP.NET Core) - Port 5000
   - Product management API
   - Built with .NET 8
   
3. **Next.js App** (React/Next.js) - Port 3001
   - Server-side rendered application
   - API routes included
   
4. **MongoDB** - Port 27017
   - NoSQL database
   - Pre-initialized with sample user data
   
5. **PostgreSQL** - Port 5432
   - SQL database
   - Pre-initialized with products and orders tables

### Monitoring System
- **Backend** (Node.js/Express/Dockerode) - Port 4000
  - Monitors all containers in bjit-network
  - Provides REST API for container info, logs, and stats
  - Uses Docker socket to communicate with Docker daemon
  
- **Frontend** (React Native/Expo)
  - Mobile-responsive UI
  - Real-time monitoring dashboard
  - View logs and resource usage
  - Auto-refresh every 5 seconds
  
- **Nginx** - Port 80
  - Reverse proxy for the system

## Network Configuration
All containers run on a shared Docker bridge network: **bjit-network**

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20+ (for local development)

### Running the System

1. **Start all containers:**
```bash
docker compose up -d --build
```

2. **Check container status:**
```bash
docker ps
```

3. **View logs:**
```bash
# Backend monitor
docker logs dnmonitor-backend

# Express API
docker logs express-api

# .NET API
docker logs dotnet-api

# Next.js App
docker logs nextjs-app
```

4. **Access the applications:**
- Frontend Monitor: http://localhost:19000 (Expo Dev Server)
- Backend API: http://localhost:4000
- Express API: http://localhost:3000
- .NET API: http://localhost:5000
- Next.js App: http://localhost:3001
- Nginx: http://localhost:80

### Stop the System
```bash
docker compose down
```

### Clean up (including volumes)
```bash
docker compose down -v
```

## API Endpoints

### Backend Monitoring API (Port 4000)

#### Get all monitored containers
```bash
GET /api/containers
```

#### Get container logs
```bash
GET /api/containers/:nameOrId/logs?tail=50
```

#### Get container statistics
```bash
GET /api/containers/:nameOrId/stats
```

#### Get container details
```bash
GET /api/containers/:nameOrId
```

#### Health check
```bash
GET /health
```

### Example API Calls

```powershell
# Get all containers
Invoke-RestMethod -Uri "http://localhost:4000/api/containers"

# Get logs for Express API
Invoke-RestMethod -Uri "http://localhost:4000/api/containers/express-api/logs?tail=20"

# Get stats for MongoDB
Invoke-RestMethod -Uri "http://localhost:4000/api/containers/mongodb/stats"
```

## Project Structure

```
DNMonitor/
├── mock-projects/
│   ├── express-api/          # Express.js mock project
│   │   ├── index.js
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── dotnet-api/           # .NET 8 mock project
│   │   ├── Program.cs
│   │   ├── dotnet-api.csproj
│   │   └── Dockerfile
│   ├── nextjs-app/           # Next.js mock project
│   │   ├── pages/
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── mongodb-init/         # MongoDB initialization scripts
│   │   └── init-mongo.js
│   └── postgresql-init/      # PostgreSQL initialization scripts
│       └── init.sql
├── backend/                  # Monitoring backend
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── frontend/                 # React Native monitoring UI
│   ├── App.js
│   ├── package.json
│   └── Dockerfile
├── nginx/                    # Nginx reverse proxy
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml        # Main orchestration file
```

## Frontend Features

- **Container List View**
  - Shows all 5 monitored containers
  - Color-coded status indicators (Green: running, Red: stopped, Yellow: restarting)
  - Container icons for easy identification
  - Port mappings display

- **Container Details Modal**
  - Last 50 lines of container logs
  - Real-time CPU and memory usage (for running containers)
  - Horizontal scroll for long log lines
  - Pull-to-refresh capability

- **Auto-refresh**
  - Refreshes container list every 5 seconds
  - Can be toggled on/off

## Database Initialization

### MongoDB
- Database: `testdb`
- Collection: `users`
- Sample documents: 3 users with name, email, age

### PostgreSQL
- Database: `testdb`
- Tables: `products`, `orders`
- Sample data: 5 products, 3 orders
- User: admin / admin123

## Docker Volumes

Persistent data storage:
- `mongodb-data`: MongoDB data persistence
- `postgresql-data`: PostgreSQL data persistence

## Troubleshooting

### Containers not starting
```bash
docker compose logs [container-name]
```

### Port conflicts
Check if ports 80, 3000, 3001, 4000, 5000, 5432, 8081, 8082, 19000-19002, 27017 are available

### View network
```bash
docker network inspect bjit-network
```

### Restart specific service
```bash
docker compose restart [service-name]
```

## Development

### Modify mock projects
Edit files in `mock-projects/` directory and rebuild:
```bash
docker compose up -d --build [service-name]
```

### Modify monitoring backend
Edit `backend/src/index.js` and rebuild:
```bash
docker compose up -d --build backend
```

### Modify frontend UI
Edit `frontend/App.js` - hot reload is enabled in development mode

## Technologies Used

- **Frontend**: React Native, Expo, Axios
- **Backend**: Node.js, Express, Dockerode, CORS
- **Mock Projects**: Express.js, ASP.NET Core 8, Next.js 14
- **Databases**: MongoDB 7, PostgreSQL 16
- **Containerization**: Docker, Docker Compose
- **Reverse Proxy**: Nginx

## License
MIT
