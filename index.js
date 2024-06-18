const express = require('express');
const { nanoid } = require('nanoid');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());

// MongoDB model
const urlSchema = new mongoose.Schema({
  longUrl: String,
  shortUrl: String,
  customAlias: String,
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});
const Url = mongoose.model('Url', urlSchema);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/urlshortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Shorten URL endpoint
app.post('/api/shorten', async (req, res) => {
  const { longUrl, customAlias } = req.body;
  let shortUrl;

  if (customAlias) {
    shortUrl = customAlias;
    const existing = await Url.findOne({ shortUrl });
    if (existing) {
      return res.status(400).json({ message: 'Custom alias already in use' });
    }
  } else {
    shortUrl = nanoid(6);
  }

  const url = new Url({ longUrl, shortUrl });
  await url.save();
  res.json({ shortUrl: `http://short.url/${shortUrl}` });
});

// Redirect to long URL
app.get('/r/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;
  const url = await Url.findOne({ shortUrl });

  if (url) {
    url.clicks++;
    await url.save();
    res.redirect(url.longUrl);
  } else {
    res.status(404).json({ message: 'URL not found' });
  }
});

// Track click stats
app.get('/api/stats/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;
  const url = await Url.findOne({ shortUrl });

  if (url) {
    res.json({ clicks: url.clicks });
  } else {
    res.status(404).json({ message: 'URL not found' });
  }
});

// Delete expired URLs
app.delete('/api/delete/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;
  const result = await Url.deleteOne({ shortUrl });
  res.json({ message: result.deletedCount ? 'URL deleted' : 'URL not found' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
