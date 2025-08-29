const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO profiles (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [name, email, hash, role]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM profiles WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.sendStatus(401);
    const token = jwt.sign({ id: user.id, role: user.role }, 'secret');
    res.json({ token, username: user.name, role: user.role });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;
