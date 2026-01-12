export default function handler(req, res) {
  console.log('[Next.js API] /api/hello endpoint accessed');
  res.status(200).json({ 
    message: 'Hello from Next.js API',
    service: 'nextjs-app',
    timestamp: new Date().toISOString()
  });
}
