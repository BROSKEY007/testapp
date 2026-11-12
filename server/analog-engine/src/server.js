'use strict';

const express = require('express');
const cors = require('cors');
const { createAnalogRouter } = require('./router');

const app = express();
const origins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()) : '*';
app.use(cors({ origin: origins }));

app.get('/', (_req, res) => {
  res.json({
    service: 'analog-engine',
    docs: 'See README.md. Try GET /api/analog/predictions or GET /api/analog/challenge-sites',
    endpoints: ['/api/analog/health', '/api/analog/predictions', '/api/analog/predict', '/api/analog/challenge-sites', '/api/analog/model']
  });
});

app.use('/api/analog', createAnalogRouter());

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`analog-engine listening on :${port}`));
