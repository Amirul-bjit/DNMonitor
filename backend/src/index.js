import express from 'express';
import Docker from 'dockerode';
import cors from 'cors';

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Containers to monitor in bjit-network
const MONITORED_CONTAINERS = [
  'express-api',
  'dotnet-api',
  'nextjs-app',
  'mongodb',
  'postgresql'
];

// GET /api/containers - Get all monitored containers with their status
app.get('/api/containers', async (req, res) => {
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
app.get('/api/containers/:nameOrId/logs', async (req, res) => {
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
app.get('/api/containers/:nameOrId/stats', async (req, res) => {
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
app.get('/api/containers/:nameOrId', async (req, res) => {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'dnmonitor-backend',
    monitoring: MONITORED_CONTAINERS
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Monitoring containers in bjit-network:`, MONITORED_CONTAINERS);
});
