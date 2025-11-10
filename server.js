// server.js - 5 PROJECT HOÀN CHỈNH
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const upload = multer();

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/public', express.static('public'));

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI);

// === SCHEMAS ===
const urlSchema = new mongoose.Schema({ original_url: String, short_url: Number });
const Url = mongoose.model('Url', urlSchema);

const exerciseSchema = new mongoose.Schema({
  username: String,
  log: [{ description: String, duration: Number, date: Date }]
});
const User = mongoose.model('User', exerciseSchema);

// === PROJECT 1: TIMESTAMP ===
app.get('/api/:date?', (req, res) => {
  let date = req.params.date;
  if (!date) date = Date.now();
  const d = new Date(isNaN(date) ? date : +date);
  if (isNaN(d)) return res.json({ error: 'Invalid Date' });
  res.json({ unix: d.getTime(), utc: d.toUTCString() });
});

// === PROJECT 2: HEADER PARSER ===
app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.headers['x-forwarded-for'] || req.ip,
    language: req.headers['accept-language'],
    software: req.headers['user-agent']
  });
});

// === PROJECT 3: URL SHORTENER ===
let shortUrlCounter = 1;
app.post('/api/shorturl', async (req, res) => {
  const { url } = req.body;
  const urlRegex = /^https?:\/\//;
  if (!urlRegex.test(url)) return res.json({ error: 'invalid url' });

  const existing = await Url.findOne({ original_url: url });
  if (existing) return res.json({ original_url: url, short_url: existing.short_url });

  const newUrl = new Url({ original_url: url, short_url: shortUrlCounter });
  await newUrl.save();
  res.json({ original_url: url, short_url: shortUrlCounter++ });
});

app.get('/api/shorturl/:short', async (req, res) => {
  const found = await Url.findOne({ short_url: +req.params.short });
  if (found) res.redirect(found.original_url);
  else res.json({ error: 'No short URL found' });
});

// === PROJECT 4: EXERCISE TRACKER ===
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  const user = new User({ username });
  await user.save();
  res.json({ username, _id: user._id });
});

app.get('/api/users', async (req, res) => {
  const users = await User.find().select('username _id');
  res.json(users);
});

app.post('/api/users/:_id/exercises', async (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;
  const user = await User.findById(_id);
  if (!user) return res.json({ error: 'User not found' });

  const exercise = { description, duration: +duration, date: date ? new Date(date) : new Date() };
  user.log.push(exercise);
  await user.save();

  res.json({
    username: user.username,
    description,
    duration: +duration,
    date: exercise.date.toDateString(),
    _id
  });
});

app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;
  const user = await User.findById(_id);
  if (!user) return res.json({ error: 'User not found' });

  let log = user.log;
  if (from) log = log.filter(e => new Date(e.date) >= new Date(from));
  if (to) log = log.filter(e => new Date(e.date) <= new Date(to));
  if (limit) log = log.slice(0, +limit);

  res.json({
    username: user.username,
    count: log.length,
    _id,
    log: log.map(e => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString()
    }))
  });
});

// === PROJECT 5: FILE METADATA ===
app.post('/api/fileanalyse', upload.single('upfile'), (req, res) => {
  if (!req.file) return res.json({ error: 'No file uploaded' });
  res.json({
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size
  });
});

// Home
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});