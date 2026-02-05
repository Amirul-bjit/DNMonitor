# WebSocket Real-Time Stats Implementation

## Overview
Implemented WebSocket (Socket.IO) support for real-time container stats streaming, while keeping the existing REST API endpoints for backward compatibility.

## Changes Made

### Backend (`backend/src/index.js`)

#### 1. Added Dependencies
- **socket.io** - WebSocket server library

#### 2. HTTP Server & Socket.IO Setup
- Created HTTP server using `createServer(app)`
- Initialized Socket.IO with CORS configuration
- Support for both WebSocket and polling transports

#### 3. WebSocket Authentication
- Added Socket.IO authentication middleware using JWT
- Verifies token from `socket.handshake.auth.token`
- Blocks connections without valid authentication

#### 4. Real-Time Stats Streaming
- **Event:** `subscribe:container:stats` - Client subscribes to container stats
- **Event:** `unsubscribe:container:stats` - Client unsubscribes from stats
- **Event:** `container:stats` - Server emits stats to client
- **Event:** `container:stats:error` - Server emits errors to client

#### 5. Stats Update Frequency
- Stats are streamed every **1 second** (1000ms) instead of 2 seconds
- More responsive real-time monitoring
- Automatic cleanup when container stops or is removed

#### 6. Enhanced Stats Data
Added network statistics to the stats response:
```javascript
{
  container: "express-api",
  cpu: "5.23%",
  memory: {
    usage: "45.23 MB",
    limit: "512.00 MB", 
    percent: "8.83%",
    used: "45.23 MB",
    total: "512.00 MB"
  },
  network: {
    rx: "1.23 MB",  // Received
    tx: "0.87 MB"   // Transmitted
  }
}
```

#### 7. Existing REST Endpoint Preserved
The REST API endpoint `/api/containers/:nameOrId/stats` remains unchanged for:
- Backward compatibility
- One-time stat queries
- Systems that don't support WebSockets

### Frontend

#### 1. Added Dependencies (`web/package.json`)
- **socket.io-client** - WebSocket client library

#### 2. Created WebSocket Hook (`web/hooks/useContainerStats.ts`)
Custom React hook for managing WebSocket connections:
- Automatic connection/disconnection
- Token-based authentication
- Subscribe/unsubscribe to container stats
- Real-time stats updates
- Error handling
- Connection status tracking

**Usage:**
```typescript
const { stats, error, isConnected } = useContainerStats({
  containerName: 'express-api',
  enabled: container.state === 'running'
})
```

#### 3. Updated Components

**ContainerCard.tsx:**
- Replaced `useQuery` polling (2000ms) with WebSocket hook
- Real-time stats updates every 1 second
- Reduced network overhead (single WebSocket vs multiple HTTP polls)
- Better performance with multiple containers

**LogModal.tsx:**
- Replaced `useQuery` polling with WebSocket hook
- Real-time stats display alongside logs
- Shows CPU, Memory, Network RX/TX stats

## Benefits

### 1. Performance
- **Single WebSocket connection** vs multiple HTTP requests
- Reduced server load (1 connection vs N polling requests)
- Lower latency updates

### 2. Real-Time Experience
- Updates every **1 second** (improved from 2 seconds)
- Bi-directional communication
- Instant error notifications

### 3. Resource Efficiency
- Automatic cleanup on component unmount
- Connection multiplexing (multiple subscriptions per connection)
- Smart interval management (stops when container stops)

### 4. Backward Compatibility
- REST API still available at `/api/containers/:nameOrId/stats`
- Can be used by scripts, external tools, or as fallback

## Testing

### Test the WebSocket Connection:
1. Start the backend: `docker compose up -d`
2. Start the frontend: `cd web && npm run dev`
3. Login to the dashboard
4. Watch real-time stats update every second
5. Check browser console for WebSocket logs:
   - `[Socket] Connected to WebSocket server`
   - Stats updates flowing in real-time

### Test Fallback to REST:
The old REST endpoint still works:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8080/api/containers/express-api/stats
```

## Architecture

```
┌─────────────────┐         WebSocket          ┌─────────────────┐
│                 │◄──────────────────────────►│                 │
│   Frontend      │    Stats every 1 second     │    Backend      │
│   (React)       │                             │   (Express +    │
│                 │         REST API            │    Socket.IO)   │
│                 │◄──────────────────────────►│                 │
└─────────────────┘    (Backward Compat)        └─────────────────┘
        │                                               │
        │                                               │
        ▼                                               ▼
  useContainerStats                               Docker API
      Hook                                        (dockerode)
```

## Environment Variables

**Frontend:**
- `NEXT_PUBLIC_API_URL` - Backend API URL (default: `http://localhost:8080/api`)
  - WebSocket URL is derived by removing `/api` suffix

**Backend:**
- `PORT` - Server port (default: 4000)
- `JWT_SECRET` - JWT signing secret

## Notes

- WebSocket connections are authenticated using the same JWT tokens as REST API
- Each socket can subscribe to multiple containers
- Intervals are automatically cleaned up on disconnect
- Network stats are calculated from Docker's network interface statistics
- Stats are only streamed for running containers
