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