const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabaseClient').supabase;

const dotenv = require('dotenv');
dotenv.config();


// const upload = multer({ dest: 'uploads/' });


const upload = multer({ storage: multer.memoryStorage() });

const pool = require('../config/db');
const authenticate = require('../middleware/authenticate');

// Upload a document
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'manager') return res.sendStatus(403);
  const { title, weight, obligatoriness } = req.body;
  
console.log('Fields:', req.body);
console.log('Files:', req.file, req.files);


  if (!req.file) {
  return res.status(400).send('No file uploaded');
}

//   const filePath = req.file.path;
//   try {
//     await pool.query(
//       'INSERT INTO documents (title, original_file_path, uploaded_by, weight, obligatoriness) VALUES ($1, $2, $3, $4, $5)',
//       [title, filePath, req.user.id, weight, obligatoriness]
//     );
//     res.sendStatus(201);
//   } catch (err) {
//     console.error(err);
//     res.sendStatus(500);
//   }
// });

try {
    // Create a unique file name
    const fileName = `${Date.now()}-${req.file.originalname}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'File upload failed' });
    }

    // Get public URL
    const { data: publicData } = supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    const publicUrl = publicData.publicUrl;

    // Save document record with Supabase URL
    await pool.query(
      'INSERT INTO documents (title, original_file_path, uploaded_by, weight, obligatoriness) VALUES ($1, $2, $3, $4, $5)',
      [title, publicUrl, req.user.id, weight, obligatoriness]
    );

    res.status(201).json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Upload route error:', err);
    res.sendStatus(500);
  }
});

// Update document's reviewed status
router.put('/:docId', async (req, res) => {
  const { docId } = req.params;
  const { reviewed } = req.body;

  if (!reviewed) {
    return res.status(400).json({ message: 'Missing "reviewed" field' });
  }

  try {
    const result = await pool.query(
      'UPDATE documents SET reviewed = $1 WHERE id = $2 RETURNING *',
      [reviewed, docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating document:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// List documents
// GET /documents
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'manager') {
      // Manager sees the catalog only
      const { rows } = await pool.query('SELECT * FROM documents ORDER BY id');
      return res.json(rows);
    }

    // Company user: join documents with their own submissions
    const { rows } = await pool.query(`
      SELECT d.id, d.title, d.description, d.weight, d.obligatoriness,
             ud.uploaded_file_path, d.reviewed
      FROM documents d
      LEFT JOIN userdocuments ud
        ON ud.document_id = d.id
       AND ud.user_id = $1
      ORDER BY d.id
    `, [req.user.id]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Download document
const path = require('path');
const fs = require('fs');

router.get('/download/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    const doc = result.rows[0];

    if (!doc) return res.sendStatus(404);

    const filePath = doc.original_file_path;
    const fileName = doc.original_file_name || `document-${doc.id}.pdf`; // fallback name

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.download(filePath, fileName);
  } catch (err) {
    console.error('Download error:', err);
    res.sendStatus(500);
  }
});

// GET /manager/progress
router.get('/manager/progress', authenticate, async (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const { rows } = await pool.query(`
      WITH total_docs AS (
        SELECT COUNT(*)::int AS total_count
        FROM documents
      ),
      user_progress AS (
        SELECT 
          p.id AS company_id,
          p.name AS company_name,
          d.id AS document_id,
          d.title,
          d.weight,
          d.obligatoriness,
          d.reviewed,
          ud.uploaded_file_path,
          CASE WHEN ud.document_id IS NOT NULL THEN 1 ELSE 0 END AS uploaded_flag
        FROM profiles p
        CROSS JOIN documents d
        LEFT JOIN userdocuments ud
          ON ud.user_id = p.id
         AND ud.document_id = d.id
        WHERE p.role = 'user'
      ),
      progress_counts AS (
        SELECT 
          company_id,
          SUM(uploaded_flag) AS uploaded_count,
          -- count missing required docs
          COUNT(*) FILTER (
            WHERE obligatoriness = true AND uploaded_flag = 0
          ) AS missing_required_documents,
          -- weighted completion percentage
          ROUND(
            100.0 * SUM(CASE WHEN uploaded_flag = 1 THEN weight ELSE 0 END)
            / NULLIF(SUM(weight), 0),
            1
          ) AS percentage_finished_weighted_uploads
        FROM user_progress
        GROUP BY company_id
      )
      SELECT 
        up.company_id,
        up.company_name,
        up.document_id,
        up.title,
        up.weight,
        up.obligatoriness,
        up.reviewed,
        up.uploaded_file_path,
        pc.uploaded_count,
        td.total_count,
        ROUND((pc.uploaded_count::decimal / td.total_count) * 100, 1) AS progress_percent,
        pc.missing_required_documents,
        pc.percentage_finished_weighted_uploads
      FROM user_progress up
      JOIN progress_counts pc 
        ON pc.company_id = up.company_id
      CROSS JOIN total_docs td
      ORDER BY up.company_name, up.document_id;
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching manager progress:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});




module.exports = router;
