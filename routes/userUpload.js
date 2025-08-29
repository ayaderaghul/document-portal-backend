const express = require('express');
const router = express.Router();
const multer = require('multer');
// const upload = multer({ dest: 'userUploads/' });
const upload = multer({ storage: multer.memoryStorage() }); // store in memory
const pool = require('../config/db');
const authenticate = require('../middleware/authenticate');
const supabase = require('../config/supabaseClient').supabase;
const dotenv = require('dotenv');
dotenv.config();
// Upload a document
router.post('/userUpload', authenticate, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'user') return res.sendStatus(403);  

  if (!req.file) {
  return res.status(400).send('No file uploaded');
}
const { docId } = req.body;
// Create a unique file path in the bucket
  const fileExt = req.file.originalname.split('.').pop();
  const fileName = `${req.user.id}/${Date.now()}.${fileExt}`;

  try {
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from(process.env.BUCKET_NAME)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).send('Error uploading file to storage');
    }
     // Optional: get a public URL (if bucket is public)
    const { data: publicUrlData } = supabase
      .storage
      .from(process.env.BUCKET_NAME)
      .getPublicUrl(fileName);

    const fileUrl = publicUrlData.publicUrl; // store this in DB

//   const filePath = req.file.path;
//   const { docId } = req.body;
  
    await pool.query(`
  INSERT INTO userdocuments (user_id, document_id, uploaded_file_path, status)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (user_id, document_id)
  DO UPDATE SET
    uploaded_file_path = EXCLUDED.uploaded_file_path,
    status = EXCLUDED.status,
    updated_at = NOW()
`, [req.user.id, docId, fileUrl, 'completed']);

    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

module.exports = router;
