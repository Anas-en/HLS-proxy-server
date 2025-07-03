const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Universal proxy handler for any URL
app.get('/proxy', (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }
  
  console.log('Proxying:', targetUrl);
  
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': getRefererFromUrl(targetUrl),
      'Accept': '*/*'
    }
  };

  const httpModule = targetUrl.startsWith('https:') ? https : http;
  
  httpModule.get(targetUrl, options, (proxyRes) => {
    // Copy headers
    Object.keys(proxyRes.headers).forEach(key => {
      res.set(key, proxyRes.headers[key]);
    });
    
    // Add CORS headers
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });

    // For m3u8 files, modify the content
    if (targetUrl.includes('.m3u8')) {
      let body = '';
      proxyRes.on('data', chunk => {
        body += chunk.toString();
      });
      
      proxyRes.on('end', () => {
        // Replace relative URLs with proxied versions
        const modifiedBody = body.replace(
          /^(?!#)(.+\.ts)$/gm,
          (match, filename) => {
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'));
            return `/proxy?url=${encodeURIComponent(baseUrl + '/' + filename)}`;
          }
        ).replace(
          /^(?!#)(.+\.m3u8)$/gm,
          (match, filename) => {
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'));
            return `/proxy?url=${encodeURIComponent(baseUrl + '/' + filename)}`;
          }
        );
        
        console.log('Modified m3u8 content');
        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(modifiedBody);
      });
    } else {
      // For other files, just pipe through
      proxyRes.pipe(res);
    }
  }).on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy failed', details: err.message });
  });
});

// Helper function to get appropriate referer
function getRefererFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/`;
  } catch (e) {
    return 'https://www.google.com/';
  }
}

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Universal HLS Proxy Server is running',
    time: new Date().toISOString(),
    usage: {
      proxy: `http://localhost:${PORT}/proxy?url=YOUR_STREAM_URL`,
      example: `http://localhost:${PORT}/proxy?url=https://example.com/stream.m3u8`
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Universal HLS Proxy Server running on http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/test`);
  console.log(`Usage: http://localhost:${PORT}/proxy?url=YOUR_STREAM_URL`);
  console.log(`Example: http://localhost:${PORT}/proxy?url=https://tataplay.slivcdn.com/hls/live/2020591/TEN3HD/master_3500.m3u8`);
});