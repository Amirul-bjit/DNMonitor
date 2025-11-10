# DNMonitor - Docker Network Monitoring Application

A full-stack application for monitoring Docker containers with a React Native (Expo) frontend and Node.js backend, all running in Docker with hot-reload support.

## 🚀 Features

- **Real-time Container Monitoring**: View all Docker containers (running and stopped)
- **Status Indicators**: Visual status indicators (green for running, red for stopped)
- **Container Logs**: View the last 10 lines of logs for any container
- **Pull to Refresh**: Manually refresh the container list
- **Hot Reload Development**: Code changes automatically reflect in the browser
- **Dockerized Setup**: Everything runs in Docker containers
- **Multi-Platform**: Run on web browser or mobile (iOS/Android via Expo Go)

## 📸 Screenshots

### Container List View
The main interface showing all Docker containers with their status indicators.

![Container List](images/image.png)

### Container Details & Logs
Click on "View Logs" to see the last 10 lines of logs for any container.

![Container Details](images/details.png)

## 📋 Prerequisites

- Docker Desktop (Windows/Mac/Linux)
- Docker Compose
- Ports available: 80, 4000, 8081, 8082, 19000-19002

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (Expo Web) - Port 8081       │
│  - React Native Web                    │
│  - Lists all Docker containers         │
│  - Shows status & logs                 │
└──────────────┬──────────────────────────┘
               │ HTTP API calls
               ↓
┌──────────────────────────────────────────┐
│  Nginx - Port 80                         │
│  - Reverse proxy                         │
│  - Routes /api → backend:4000           │
└──────────────┬───────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────┐
│  Backend - Port 4000                     │
│  - Node.js + Express                    │
│  - Dockerode (Docker API client)        │
│  - Connected to Docker socket           │
└──────────────┬───────────────────────────┘
               │
               ↓
    Docker Socket (/var/run/docker.sock)
```

## 📁 Project Structure

```
DNMonitor/
├── backend/
│   ├── src/
│   │   └── index.js          # Express server with Docker API
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── App.js                # React Native main app
│   ├── app.json              # Expo configuration
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── nginx.conf            # Nginx reverse proxy config
│   └── Dockerfile
├── images/
│   ├── image.png             # Container list screenshot
│   └── details.png           # Container logs screenshot
├── docker-compose.yml        # Orchestrates all services
└── README.md
```

## 🚦 Quick Start

### 1. Clone or navigate to the project directory

```bash
cd DNMonitor
```

### 2. Start all services

```bash
docker compose up -d --build
```

This will:
- Build all Docker images (backend, frontend, nginx)
- Start all containers in detached mode
- Install all dependencies
- Set up hot-reload for development

### 3. Access the application

- **Web Application**: http://localhost:8081
- **API Endpoint**: http://localhost/api/containers
- **Health Check**: http://localhost/health

### 4. View logs (optional)

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f nginx
```

## 🖥️ Server Setup (Deploy to your server)

### 1. Copy to your server

```bash
# Copy backend and nginx folders to your server
scp -r backend nginx docker-compose.yml user@your-server:/path/to/dnmonitor/
```

### 2. Deploy on server

```bash
cd /path/to/dnmonitor
docker compose up --build -d
```

### 3. Verify

```bash
curl http://localhost/api/containers
```

### 4. Configure firewall (if needed)

```bash
# Allow port 80
sudo ufw allow 80/tcp
```

## 📱 Mobile Setup (Run on your phone)

### 1. Install Expo Go on your phone

- Android: [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
- iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

### 2. Update API URL in `frontend/App.js`

```javascript
const API_URL = 'http://YOUR_SERVER_IP/api';
```

Replace `YOUR_SERVER_IP` with your actual server IP address.

### 3. Install dependencies

```bash
cd frontend
npm install
```

### 4. Start Expo

```bash
npx expo start
```

### 5. Scan QR code with Expo Go app on your phone

**Notes:**
- Make sure your server IP is accessible from your mobile device
- If using HTTPS, update the API_URL to use `https://`
- For production, consider using environment variables or a config file for the API URL

## 🔌 API Endpoints

### Get all containers
```
GET /api/containers
```

**Response:**
```json
[
  {
    "id": "abc123...",
    "name": "dnmonitor-backend",
    "image": "dnmonitor-backend:latest",
    "state": "running",
    "ports": [
      {
        "private": 4000,
        "public": null,
        "type": "tcp"
      }
    ]
  }
]
```

### Get container logs
```
GET /api/containers/:id/logs
```

**Response:** Plain text with last 10 log lines

### Health check
```
GET /health
```

## 📦 Technologies Used

### Frontend
- React Native
- Expo (v50.0.0)
- React Native Web
- React DOM (for web support)
- Axios

### Backend
- Node.js
- Express
- Dockerode (Docker API client)
- CORS

### Infrastructure
- Docker & Docker Compose
- Nginx (Reverse Proxy)

## 🔧 Configuration

### Environment Variables

#### Frontend (`docker-compose.yml`)
- `EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0` - Allow external connections
- `REACT_NATIVE_PACKAGER_HOSTNAME` - Set to your local IP for mobile testing

#### Backend
- `PORT=4000` - Backend server port (default: 4000)

### Ports

| Service  | Internal Port | External Port | Description              |
|----------|---------------|---------------|--------------------------|
| Nginx    | 80            | 80            | Reverse proxy            |
| Backend  | 4000          | -             | API server (internal)    |
| Frontend | 8081          | 8081          | Metro bundler (web)      |
| Frontend | 8082          | 8082          | Web server               |
| Frontend | 19000-19002   | 19000-19002   | Expo DevTools            |

## 🛠️ Development

### Hot Reload

The frontend is configured with volume mounting for hot-reload. Any changes to `frontend/App.js` will automatically refresh in the browser.

```bash
# Make changes to frontend/App.js and watch them reload automatically!
```

### Stop the application

```bash
docker compose down
```

### Rebuild after changes

```bash
docker compose up -d --build
```

### Making Changes

1. **Frontend changes**: Edit `frontend/App.js` → changes auto-reload in browser
2. **Backend changes**: Edit `backend/src/index.js` → restart backend:
   ```bash
   docker compose restart backend
   ```
3. **Nginx changes**: Edit `nginx/nginx.conf` → rebuild nginx:
   ```bash
   docker compose up -d --build nginx
   ```

### Adding Dependencies

#### Frontend
1. Add package to `frontend/package.json`
2. Rebuild:
   ```bash
   docker compose up -d --build frontend
   ```

#### Backend
1. Add package to `backend/package.json`
2. Rebuild:
   ```bash
   docker compose up -d --build backend
   ```

## 🐛 Troubleshooting

### Containers won't start

```bash
# Clean up and restart
docker compose down
docker compose up -d --build
```

### Port already in use

```bash
# Find what's using the port
netstat -ano | findstr :8081  # Windows
lsof -i :8081                  # Mac/Linux

# Stop the conflicting process or change ports in docker-compose.yml
```

### Frontend not loading

```bash
# Check frontend logs
docker logs -f dnmonitor-frontend

# Rebuild frontend
docker compose up -d --build frontend
```

### Cannot connect to Docker socket

- Ensure Docker Desktop is running
- Check Docker socket is mounted: `/var/run/docker.sock:/var/run/docker.sock`

### Nginx keeps restarting

```bash
# Check nginx config syntax
docker exec dnmonitor-nginx nginx -t

# View nginx logs
docker logs dnmonitor-nginx
```

### API calls failing from frontend

- Check API_URL in `frontend/App.js` is set to `http://localhost/api`
- Verify backend is running: `docker ps | grep dnmonitor-backend`
- Test API directly: `curl http://localhost/api/containers`

## 📝 Notes

- The application monitors the Docker instance it's running in (Docker-in-Docker)
- Container logs show only the last 10 lines (configurable in `backend/src/index.js`)
- Nginx serves as a reverse proxy to handle CORS and routing
- Frontend runs in web mode by default (can also run on mobile via Expo Go)
- Volume mounting enables hot-reload without rebuilding containers
- Favicon warnings in logs are harmless and don't affect functionality

## 🎯 Future Enhancements

- [ ] Real-time updates using WebSockets
- [ ] Container start/stop/restart functionality
- [ ] Resource usage metrics (CPU, Memory)
- [ ] Container filtering and search
- [ ] Dark mode support
- [ ] Export logs functionality
- [ ] Multi-host Docker support
- [ ] Authentication/Authorization
- [ ] Persist settings/preferences
- [ ] Container stats visualization

## 🤝 Contributing

Feel free to fork this project and submit pull requests for any improvements!

## 📄 License

This project is open source and available for educational and personal use.

---

**Built with ❤️ using Docker, React Native, Expo, and Node.js**