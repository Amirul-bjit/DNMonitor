const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Mock data
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
];

app.get('/', (req, res) => {
  console.log('[Express API] Root endpoint accessed');
  res.json({ message: 'Express API is running', service: 'express-api' });
});

app.get('/api/users', (req, res) => {
  console.log('[Express API] Fetching all users');
  res.json(users);
});

app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (user) {
    console.log(`[Express API] User ${req.params.id} found`);
    res.json(user);
  } else {
    console.error(`[Express API] User ${req.params.id} not found`);
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/users', (req, res) => {
  const newUser = { id: users.length + 1, ...req.body };
  users.push(newUser);
  console.log('[Express API] New user created:', newUser);
  res.status(201).json(newUser);
});

app.listen(port, () => {
  console.log(`[Express API] Server started successfully on port ${port}`);
  console.log('[Express API] Available endpoints: GET /, GET /api/users, POST /api/users');
  
  // Simulate periodic activity
  setInterval(() => {
    console.log('[Express API] Health check - System operational');
  }, 30000);
});
