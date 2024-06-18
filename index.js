const express = require('express');
const { nanoid } = require('nanoid');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

let mongoUri = null;

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

// Middleware to check MongoDB connection
const ensureMongoConnected = async (req, res, next) => {
  if (!mongoUri) {
    return res.status(400).json({ message: 'MongoDB URI not configured' });
  }
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  next();
};

// Endpoint to set MongoDB URI
app.post('/config', async (req, res) => {
  try {
    mongoUri = req.body.mongoUri;
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    res.status(200).json({ message: 'MongoDB URI configured successfully' });
  } catch (err) {
    console.error('Error configuring MongoDB:', err);
    res.status(500).json({ message: 'Error configuring MongoDB' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Shorten URL endpoint
app.post('/api/shorten', ensureMongoConnected, async (req, res) => {
  try {
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
    res.json({ shortUrl: `https://yourdomain.vercel.app/r/${shortUrl}` });
  } catch (err) {
    console.error('Error in /api/shorten:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Redirect to long URL
app.get('/r/:shortUrl', ensureMongoConnected, async (req, res) => {
  try {
    const { shortUrl } = req.params;
    const url = await Url.findOne({ shortUrl });

    if (url) {
      url.clicks++;
      await url.save();
      res.redirect(url.longUrl);
    } else {
      res.status(404).json({ message: 'URL not found' });
    }
  } catch (err) {
    console.error('Error in /r/:shortUrl:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Track click stats
app.get('/api/stats/:shortUrl', ensureMongoConnected, async (req, res) => {
  try {
    const { shortUrl } = req.params;
    const url = await Url.findOne({ shortUrl });

    if (url) {
      res.json({ clicks: url.clicks });
    } else {
      res.status(404).json({ message: 'URL not found' });
    }
  } catch (err) {
    console.error('Error in /api/stats/:shortUrl:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete expired URLs
app.delete('/api/delete/:shortUrl', ensureMongoConnected, async (req, res) => {
  try {
    const { shortUrl } = req.params;
    const result = await Url.deleteOne({ shortUrl });
    res.json({ message: result.deletedCount ? 'URL deleted' : 'URL not found' });
  } catch (err) {
    console.error('Error in /api/delete/:shortUrl:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
