import express from 'express';
import fs from 'fs';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());

app.get('/api/tools', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/tools.json', 'utf8'));
  res.json(data);
});

app.get('/api/slogans', (req, res) => {
  const data = JSON.parse(fs.readFileSync('./data/slogans.json', 'utf8'));
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
