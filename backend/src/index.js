import express from 'express';
import Docker from 'dockerode';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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

// POST /api/containers/:nameOrId/start - Start a container
app.post('/api/containers/:nameOrId/start', async (req, res) => {
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
app.post('/api/containers/:nameOrId/stop', async (req, res) => {
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
app.post('/api/containers/:nameOrId/restart', async (req, res) => {
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
app.delete('/api/containers/:nameOrId', async (req, res) => {
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
app.post('/api/compose/up', async (req, res) => {
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
app.post('/api/compose/down', async (req, res) => {
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
app.post('/api/compose/rebuild', async (req, res) => {
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
