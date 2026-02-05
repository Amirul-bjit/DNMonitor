import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Docker from 'dockerode';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const execAsync = promisify(exec);
const app = express();
const httpServer = createServer(app);
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 4000;

// Socket.IO setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3002',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:19000',
      'http://localhost:19001',
      'http://localhost:19002'
    ],
    credentials: true
  }
});

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

// Hardcoded users with hashed passwords
// Default password for all users: "admin123"
const USERS = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@dnmonitor.com',
    // Hash of "admin123"
    passwordHash: '$2a$10$Bf8Oct.9rtt9GaH0M8C8X.XceIiLvBzPud4SqG4Cuj5Iz6d2cQW.e',
    role: 'admin'
  },
  {
    id: 2,
    username: 'monitor',
    email: 'monitor@dnmonitor.com',
    // Hash of "admin123"
    passwordHash: '$2a$10$Bf8Oct.9rtt9GaH0M8C8X.XceIiLvBzPud4SqG4Cuj5Iz6d2cQW.e',
    role: 'viewer'
  }
];

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:19000',
    'http://localhost:19001',
    'http://localhost:19002'
  ],
  credentials: true
}));
app.use(express.json());

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = USERS.find(u => u.username === username || u.email === username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  // Since JWT is stateless, logout is handled client-side
  res.json({ success: true, message: 'Logged out successfully' });
});

// Containers to monitor in bjit-network
const MONITORED_CONTAINERS = [
  'express-api',
  'dotnet-api',
  'nextjs-app',
  'mongodb',
  'postgresql'
];

// GET /api/containers - Get all monitored containers with their status
app.get('/api/containers', authenticateToken, async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    
    const monitoredContainers = containers
      .filter(c => MONITORED_CONTAINERS.some(name => c.Names[0].includes(name)))
      .map(c => ({
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, '') || '',
        image: c.Image,
        state: c.State,
        status: c.Status,
        created: c.Created,
        ports: c.Ports.map(p => ({
          private: p.PrivatePort,
          public: p.PublicPort,
          type: p.Type
        }))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json(monitoredContainers);
  } catch (err) {
    console.error('[Backend] Error fetching containers:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/:nameOrId/logs - Get logs for a specific container
app.get('/api/containers/:nameOrId/logs', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    const tail = req.query.tail || 100;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    const logs = await dockerContainer.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail),
      timestamps: true
    });

    // Parse Docker logs (remove Docker stream headers)
    const logText = logs.toString('utf8')
      .split('\n')
      .map(line => {
        // Remove Docker stream headers (first 8 bytes)
        if (line.length > 8) {
          return line.substring(8);
        }
        return line;
      })
      .filter(line => line.trim())
      .join('\n');

    res.json({ 
      container: container.Names[0].replace('/', ''),
      logs: logText 
    });
  } catch (err) {
    console.error('[Backend] Error fetching logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/:nameOrId/stats - Get real-time stats for a container
app.get('/api/containers/:nameOrId/stats', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    const stats = await dockerContainer.stats({ stream: false });

    // Calculate CPU percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

    // Calculate memory usage
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 0;
    const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

    res.json({
      container: container.Names[0].replace('/', ''),
      cpu: cpuPercent.toFixed(2) + '%',
      memory: {
        usage: (memoryUsage / 1024 / 1024).toFixed(2) + ' MB',
        limit: (memoryLimit / 1024 / 1024).toFixed(2) + ' MB',
        percent: memoryPercent.toFixed(2) + '%'
      }
    });
  } catch (err) {
    console.error('[Backend] Error fetching stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/containers/:nameOrId - Get detailed info about a container
app.get('/api/containers/:nameOrId', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    const info = await dockerContainer.inspect();

    res.json({
      id: info.Id,
      name: info.Name.replace('/', ''),
      image: info.Config.Image,
      state: info.State,
      created: info.Created,
      platform: info.Platform,
      restartCount: info.RestartCount,
      networkSettings: info.NetworkSettings.Networks
    });
  } catch (err) {
    console.error('[Backend] Error fetching container details:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/containers/:nameOrId/start - Start a container
app.post('/api/containers/:nameOrId/start', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    await dockerContainer.start();
    
    res.json({ success: true, message: `Container ${container.Names[0]} started` });
  } catch (err) {
    console.error('[Backend] Error starting container:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/containers/:nameOrId/stop - Stop a container
app.post('/api/containers/:nameOrId/stop', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    await dockerContainer.stop();
    
    res.json({ success: true, message: `Container ${container.Names[0]} stopped` });
  } catch (err) {
    console.error('[Backend] Error stopping container:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/containers/:nameOrId/restart - Restart a container
app.post('/api/containers/:nameOrId/restart', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    await dockerContainer.restart();
    
    res.json({ success: true, message: `Container ${container.Names[0]} restarted` });
  } catch (err) {
    console.error('[Backend] Error restarting container:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/containers/:nameOrId - Remove a container with volumes
app.delete('/api/containers/:nameOrId', authenticateToken, async (req, res) => {
  try {
    const nameOrId = req.params.nameOrId;
    const { volumes } = req.query;
    
    const containers = await docker.listContainers({ all: true });
    const container = containers.find(c => 
      c.Id === nameOrId || c.Names[0].includes(nameOrId)
    );
    
    if (!container) {
      return res.status(404).json({ error: 'Container not found' });
    }

    const dockerContainer = docker.getContainer(container.Id);
    
    // Stop container first if running
    if (container.State === 'running') {
      await dockerContainer.stop();
    }
    
    // Remove container with volumes option
    await dockerContainer.remove({ v: volumes === 'true' });
    
    res.json({ 
      success: true, 
      message: `Container ${container.Names[0]} removed${volumes === 'true' ? ' with volumes' : ''}`
    });
  } catch (err) {
    console.error('[Backend] Error removing container:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/compose/up - Start all compose services
app.post('/api/compose/up', authenticateToken, async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('docker compose up -d', { cwd: '/app' });
    res.json({ 
      success: true, 
      message: 'Compose services started',
      output: stdout || stderr 
    });
  } catch (err) {
    console.error('[Backend] Error starting compose:', err);
    res.status(500).json({ error: err.message, output: err.stderr });
  }
});

// POST /api/compose/down - Stop all compose services
app.post('/api/compose/down', authenticateToken, async (req, res) => {
  try {
    const { removeOrphans } = req.query;
    const command = removeOrphans === 'true' 
      ? 'docker compose down --remove-orphans' 
      : 'docker compose down';
    
    const { stdout, stderr } = await execAsync(command, { cwd: '/app' });
    res.json({ 
      success: true, 
      message: 'Compose services stopped',
      output: stdout || stderr 
    });
  } catch (err) {
    console.error('[Backend] Error stopping compose:', err);
    res.status(500).json({ error: err.message, output: err.stderr });
  }
});

// POST /api/compose/rebuild - Rebuild and start compose services
app.post('/api/compose/rebuild', authenticateToken, async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync('docker compose up --build -d', { cwd: '/app' });
    res.json({ 
      success: true, 
      message: 'Compose services rebuilt and started',
      output: stdout || stderr 
    });
  } catch (err) {
    console.error('[Backend] Error rebuilding compose:', err);
    res.status(500).json({ error: err.message, output: err.stderr });
  }
});

// GET /api/system/stats - Get host machine system stats
app.get('/api/system/stats', authenticateToken, async (req, res) => {
  try {
    // Get CPU stats from /proc/stat
    const { stdout: cpuInfo } = await execAsync("cat /proc/stat | grep '^cpu ' | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'");
    const cpuUsage = parseFloat(cpuInfo.trim()) || 0;

    // Get memory stats from /proc/meminfo
    const { stdout: memInfo } = await execAsync("cat /proc/meminfo | grep -E 'MemTotal|MemAvailable' | awk '{print $2}'");
    const memLines = memInfo.trim().split('\n');
    const memTotal = parseInt(memLines[0]) || 0;
    const memAvailable = parseInt(memLines[1]) || 0;
    const memUsed = memTotal - memAvailable;
    const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

    // Get disk stats
    const { stdout: diskInfo } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$5}'");
    const diskParts = diskInfo.trim().split(' ');
    
    // Get number of CPU cores
    const { stdout: cpuCores } = await execAsync("nproc");
    const cores = parseInt(cpuCores.trim()) || 1;

    // Get hostname
    const { stdout: hostname } = await execAsync("hostname");

    // Get CPU model
    const { stdout: cpuModel } = await execAsync("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d ':' -f2 | xargs").catch(() => ({ stdout: 'Unknown CPU' }));

    // Get platform and architecture
    const { stdout: platform } = await execAsync("uname -s").catch(() => ({ stdout: 'Linux' }));
    const { stdout: arch } = await execAsync("uname -m").catch(() => ({ stdout: 'x86_64' }));

    // Get uptime in minutes
    const { stdout: uptimeSeconds } = await execAsync("cat /proc/uptime | cut -d ' ' -f1").catch(() => ({ stdout: '0' }));
    const uptime = Math.floor(parseFloat(uptimeSeconds.trim()) / 60);

    res.json({
      hostname: hostname.trim(),
      platform: platform.trim(),
      arch: arch.trim(),
      cpu: {
        model: cpuModel.trim(),
        percent: cpuUsage.toFixed(2) + '%',
        cores: cores
      },
      memory: {
        total: (memTotal / 1024 / 1024).toFixed(2) + ' GB',
        used: (memUsed / 1024 / 1024).toFixed(2) + ' GB',
        available: (memAvailable / 1024 / 1024).toFixed(2) + ' GB',
        percent: memPercent.toFixed(2) + '%'
      },
      disk: {
        total: diskParts[0] || 'N/A',
        used: diskParts[1] || 'N/A',
        percent: diskParts[2] || 'N/A'
      },
      uptime: uptime,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Backend] Error fetching system stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'dnmonitor-backend',
    monitoring: MONITORED_CONTAINERS
  });
});

// WebSocket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error('Invalid token'));
    }
    socket.user = user;
    next();
  });
});

// Helper function to get containers list
const getContainersList = async () => {
  const containers = await docker.listContainers({ all: true });
  
  const monitoredContainers = containers
    .filter(c => MONITORED_CONTAINERS.some(name => c.Names[0].includes(name)))
    .map(c => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || '',
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      ports: c.Ports.map(p => ({
        private: p.PrivatePort,
        public: p.PublicPort,
        type: p.Type
      }))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return monitoredContainers;
};

// Helper function to get system stats
const getSystemStats = async () => {
  // Get CPU stats from /proc/stat
  const { stdout: cpuInfo } = await execAsync("cat /proc/stat | grep '^cpu ' | awk '{usage=($2+$4)*100/($2+$4+$5)} END {print usage}'");
  const cpuUsage = parseFloat(cpuInfo.trim()) || 0;

  // Get memory stats from /proc/meminfo
  const { stdout: memInfo } = await execAsync("cat /proc/meminfo | grep -E 'MemTotal|MemAvailable' | awk '{print $2}'");
  const memLines = memInfo.trim().split('\n');
  const memTotal = parseInt(memLines[0]) || 0;
  const memAvailable = parseInt(memLines[1]) || 0;
  const memUsed = memTotal - memAvailable;
  const memPercent = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  // Get disk stats
  const { stdout: diskInfo } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$5}'");
  const diskParts = diskInfo.trim().split(' ');
  
  // Get number of CPU cores
  const { stdout: cpuCores } = await execAsync("nproc");
  const cores = parseInt(cpuCores.trim()) || 1;

  // Get hostname
  const { stdout: hostname } = await execAsync("hostname");

  // Get CPU model
  const { stdout: cpuModel } = await execAsync("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d ':' -f2 | xargs").catch(() => ({ stdout: 'Unknown CPU' }));

  // Get platform and architecture
  const { stdout: platform } = await execAsync("uname -s").catch(() => ({ stdout: 'Linux' }));
  const { stdout: arch } = await execAsync("uname -m").catch(() => ({ stdout: 'x86_64' }));

  // Get uptime in minutes
  const { stdout: uptimeSeconds } = await execAsync("cat /proc/uptime | cut -d ' ' -f1").catch(() => ({ stdout: '0' }));
  const uptime = Math.floor(parseFloat(uptimeSeconds.trim()) / 60);

  return {
    hostname: hostname.trim(),
    platform: platform.trim(),
    arch: arch.trim(),
    cpu: {
      model: cpuModel.trim(),
      percent: cpuUsage.toFixed(2) + '%',
      cores: cores
    },
    memory: {
      total: (memTotal / 1024 / 1024).toFixed(2) + ' GB',
      used: (memUsed / 1024 / 1024).toFixed(2) + ' GB',
      available: (memAvailable / 1024 / 1024).toFixed(2) + ' GB',
      percent: memPercent.toFixed(2) + '%'
    },
    disk: {
      total: diskParts[0] || 'N/A',
      used: diskParts[1] || 'N/A',
      percent: diskParts[2] || 'N/A'
    },
    uptime: uptime,
    timestamp: new Date().toISOString()
  };
};

// Helper function to get container stats
const getContainerStats = async (nameOrId) => {
  const containers = await docker.listContainers({ all: true });
  const container = containers.find(c => 
    c.Id === nameOrId || c.Names[0].includes(nameOrId)
  );
  
  if (!container) {
    throw new Error('Container not found');
  }

  if (container.State !== 'running') {
    throw new Error('Container is not running');
  }

  const dockerContainer = docker.getContainer(container.Id);
  const stats = await dockerContainer.stats({ stream: false });

  // Calculate CPU percentage
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
  const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

  // Calculate memory usage
  const memoryUsage = stats.memory_stats.usage || 0;
  const memoryLimit = stats.memory_stats.limit || 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100 : 0;

  // Calculate network stats (simplified)
  const networks = stats.networks || {};
  let totalRx = 0;
  let totalTx = 0;
  Object.values(networks).forEach((net) => {
    totalRx += net.rx_bytes || 0;
    totalTx += net.tx_bytes || 0;
  });

  return {
    container: container.Names[0].replace('/', ''),
    cpu: cpuPercent.toFixed(2) + '%',
    memory: {
      usage: (memoryUsage / 1024 / 1024).toFixed(2) + ' MB',
      limit: (memoryLimit / 1024 / 1024).toFixed(2) + ' MB',
      percent: memoryPercent.toFixed(2) + '%',
      used: (memoryUsage / 1024 / 1024).toFixed(2) + ' MB',
      total: (memoryLimit / 1024 / 1024).toFixed(2) + ' MB'
    },
    network: {
      rx: (totalRx / 1024 / 1024).toFixed(2) + ' MB',
      tx: (totalTx / 1024 / 1024).toFixed(2) + ' MB'
    }
  };
};

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${socket.user.username})`);

  // Map to track active subscriptions per socket
  const activeIntervals = new Map();

  // Subscribe to container stats
  socket.on('subscribe:container:stats', async ({ containerName }) => {
    try {
      console.log(`[Socket.IO] ${socket.user.username} subscribed to stats for: ${containerName}`);

      // Send initial stats immediately
      try {
        const stats = await getContainerStats(containerName);
        socket.emit('container:stats', stats);
      } catch (err) {
        socket.emit('container:stats:error', { 
          container: containerName,
          error: err.message 
        });
      }

      // Set up interval to send stats every second
      const intervalId = setInterval(async () => {
        try {
          const stats = await getContainerStats(containerName);
          socket.emit('container:stats', stats);
        } catch (err) {
          socket.emit('container:stats:error', { 
            container: containerName,
            error: err.message 
          });
          // If container not found or not running, clear the interval
          if (err.message.includes('not found') || err.message.includes('not running')) {
            const id = activeIntervals.get(containerName);
            if (id) {
              clearInterval(id);
              activeIntervals.delete(containerName);
            }
          }
        }
      }, 1000); // Update every second

      // Store interval ID
      if (activeIntervals.has(containerName)) {
        clearInterval(activeIntervals.get(containerName));
      }
      activeIntervals.set(containerName, intervalId);

    } catch (err) {
      socket.emit('container:stats:error', { 
        container: containerName,
        error: err.message 
      });
    }
  });

  // Unsubscribe from container stats
  socket.on('unsubscribe:container:stats', ({ containerName }) => {
    console.log(`[Socket.IO] ${socket.user.username} unsubscribed from stats for: ${containerName}`);
    const intervalId = activeIntervals.get(containerName);
    if (intervalId) {
      clearInterval(intervalId);
      activeIntervals.delete(containerName);
    }
  });

  // Subscribe to containers list
  socket.on('subscribe:containers', async () => {
    try {
      console.log(`[Socket.IO] ${socket.user.username} subscribed to containers list`);

      // Send initial containers list immediately
      try {
        const containers = await getContainersList();
        socket.emit('containers:list', containers);
      } catch (err) {
        socket.emit('containers:error', { 
          error: err.message 
        });
      }

      // Set up interval to send containers list every 5 seconds
      const intervalId = setInterval(async () => {
        try {
          const containers = await getContainersList();
          socket.emit('containers:list', containers);
        } catch (err) {
          socket.emit('containers:error', { 
            error: err.message 
          });
        }
      }, 5000); // Update every 5 seconds

      // Store interval ID with a special key for containers list
      const containersKey = '__containers_list__';
      if (activeIntervals.has(containersKey)) {
        clearInterval(activeIntervals.get(containersKey));
      }
      activeIntervals.set(containersKey, intervalId);

    } catch (err) {
      socket.emit('containers:error', { 
        error: err.message 
      });
    }
  });

  // Unsubscribe from containers list
  socket.on('unsubscribe:containers', () => {
    console.log(`[Socket.IO] ${socket.user.username} unsubscribed from containers list`);
    const containersKey = '__containers_list__';
    const intervalId = activeIntervals.get(containersKey);
    if (intervalId) {
      clearInterval(intervalId);
      activeIntervals.delete(containersKey);
    }
  });

  // Subscribe to system stats
  socket.on('subscribe:system:stats', async () => {
    try {
      console.log(`[Socket.IO] ${socket.user.username} subscribed to system stats`);

      // Send initial stats immediately
      try {
        const stats = await getSystemStats();
        socket.emit('system:stats', stats);
      } catch (err) {
        socket.emit('system:stats:error', { 
          error: err.message 
        });
      }

      // Set up interval to send stats every second
      const intervalId = setInterval(async () => {
        try {
          const stats = await getSystemStats();
          socket.emit('system:stats', stats);
        } catch (err) {
          socket.emit('system:stats:error', { 
            error: err.message 
          });
        }
      }, 1000); // Update every second

      // Store interval ID with a special key for system stats
      const systemStatsKey = '__system_stats__';
      if (activeIntervals.has(systemStatsKey)) {
        clearInterval(activeIntervals.get(systemStatsKey));
      }
      activeIntervals.set(systemStatsKey, intervalId);

    } catch (err) {
      socket.emit('system:stats:error', { 
        error: err.message 
      });
    }
  });

  // Unsubscribe from system stats
  socket.on('unsubscribe:system:stats', () => {
    console.log(`[Socket.IO] ${socket.user.username} unsubscribed from system stats`);
    const systemStatsKey = '__system_stats__';
    const intervalId = activeIntervals.get(systemStatsKey);
    if (intervalId) {
      clearInterval(intervalId);
      activeIntervals.delete(systemStatsKey);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    // Clear all intervals for this socket
    activeIntervals.forEach((intervalId) => clearInterval(intervalId));
    activeIntervals.clear();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Monitoring containers in bjit-network:`, MONITORED_CONTAINERS);
});
