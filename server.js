// server.js
const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('./config/db');
const cors = require('cors');
require('dotenv').config();


const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const userUploadRoutes = require('./routes/userUpload');
const authenticate = require('./middleware/authenticate');


const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static('dist'))

app.get('/', (req, res) => {
  res.send('Server is up and running!');
});
app.use('/auth', authRoutes);
app.use('/documents', documentRoutes);
app.use('/users', userUploadRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
