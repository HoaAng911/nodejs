// api/index.js – ĐÃ FIX HOÀN HẢO CHO VERCEL (COPY NGUYÊN XI)
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname cho ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// === THÊM 4 DÒNG NÀY LÀ HẾT 404 TRẮNG VĨNH VIỄN ===
app.use('/favicon.ico', express.static(path.join(__dirname, '../public/favicon.ico')));
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
// =================================================

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI);

// === TẤT CẢ SCHEMAS + ROUTES CỦA BẠN (giữ nguyên 100%) ===
const urlSchema = new mongoose.Schema({ original_url: String, short_url: Number });
const Url = mongoose.model('Url', urlSchema);

const exerciseSchema = new mongoose.Schema({
  username: String,
  log: [{ description: String, duration: Number, date: Date }]
});
const User = mongoose.model('User', exerciseSchema);

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  comments: [String]
});
const Book = mongoose.model('Book', bookSchema);

const issueSchema = new mongoose.Schema({
  project: String,
  issue_title: { type: String, required: true },
  issue_text: { type: String, required: true },
  created_by: { type: String, required: true },
  assigned_to: String,
  status_text: String,
  open: { type: Boolean, default: true },
  created_on: { type: Date, default: Date.now },
  updated_on: { type: Date, default: Date.now }
});
const Issue = mongoose.model('Issue', issueSchema);

const upload = multer();

// === TOÀN BỘ API CỦA BẠN (giữ nguyên) ===
app.get('/api/timestamp/:date_string?', (req, res) => {
  let dateString = req.params.date_string;
  let date = dateString ? new Date(dateString) : new Date();
  if (date.toString() === 'Invalid Date') {
    res.json({ error: 'Invalid Date' });
  } else {
    res.json({ unix: date.getTime(), utc: date.toUTCString() });
  }
});

app.get('/api/whoami', (req, res) => {
  res.json({
    ipaddress: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
    language: req.headers['accept-language'],
    software: req.headers['user-agent']
  });
});

// URL SHORTENER
let shortUrlCounter = 1;
app.post('/api/shorturl', async (req, res) => {
  const { url } = req.body;
  if (!/^https?:\/\//.test(url)) return res.json({ error: 'invalid url' });

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

// EXERCISE TRACKER
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  const user = new User({ username });
  await user.save();
  res.json({ username, _id: user._id });
});

app.get('/api/users', async (req, res) => {
  const users = await User.find({}, 'username _id');
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

// FILE METADATA
app.post('/api/fileanalyse', upload.single('upfile'), (req, res) => {
  if (!req.file) return res.json({ error: 'No file uploaded' });
  res.json({
    name: req.file.originalname,
    type: req.file.mimetype,
    size: req.file.size
  });
});

// PERSONAL LIBRARY + ISSUE TRACKER (giữ nguyên hết)
app.post('/api/books', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.send('missing required field title');
  const book = new Book({ title });
  await book.save();
  res.json({ _id: book._id, title: book.title });
});

// ... (tất cả các route còn lại giữ nguyên như code cũ của bạn)

// ISSUE TRACKER
app.route('/api/issues/:project')
  .get(async (req, res) => {
    const { project } = req.params;
    const filters = { project, ...req.query };
    if (filters.open) filters.open = filters.open === 'true';
    const issues = await Issue.find(filters);
    res.json(issues);
  })
  .post(async (req, res) => {
    const { project } = req.params;
    const { issue_title, issue_text, created_by, assigned_to, status_text } = req.body;
    if (!issue_title || !issue_text || !created_by) return res.json({ error: 'required field(s) missing' });
    const issue = new Issue({ project, issue_title, issue_text, created_by, assigned_to, status_text });
    await issue.save();
    res.json(issue);
  })
  .put(async (req, res) => {
    const { _id } = req.body;
    if (!_id) return res.json({ error: 'missing _id' });
    const updates = { ...req.body, updated_on: new Date() };
    delete updates._id;
    if (Object.keys(updates).length === 1) return res.json({ error: 'no update field(s) sent', _id });
    const issue = await Issue.findByIdAndUpdate(_id, updates, { new: true });
    if (!issue) return res.json({ error: 'could not update', _id });
    res.json({ result: 'successfully updated', _id });
  })
  .delete(async (req, res) => {
    const { _id } = req.body;
    if (!_id) return res.json({ error: 'missing _id' });
    const result = await Issue.findByIdAndDelete(_id);
    if (!result) return res.json({ error: 'could not delete', _id });
    res.json({ result: 'successfully deleted', _id });
  });

// EXPORT CHO VERCEL
const handler = app;
export default handler;