# 📂 Document Portal Dashboard – Backend
This is the backend API for the Paperwork Dashboard application. It provides endpoints for:

User authentication (JWT‑based)

Document management (view, upload, download)

Progress tracking for companies (users) and managers

File uploads using Multer

PostgreSQL database integration

Deployed to Render https://document-portal-backend-mnhl.onrender.com/

# 🚀 Tech Stack
Node.js + Express – API server

PostgreSQL – relational database

pg – PostgreSQL client for Node.js

Multer – file upload middleware

JWT – authentication & authorization

dotenv – environment variable management

Supabase - for storage

# 📦 Installation
Clone the repository

Install dependencies

Create .env file in the project root:

.env
DB_USER
DB_HOST
DB_NAME
DB_PASS
DB_PORT

Set up the database

Create the database in PostgreSQL.

Run your schema/migration scripts to create tables:

documents

userdocuments

profiles (users/companies/managers)

Ensure (user_id, document_id) in userdocuments has a UNIQUE constraint for UPSERTs.

# ▶️ Running the Server

# 🔑 Authentication
JWT tokens are issued on login and must be sent in the Authorization header:

Code
Authorization: Bearer <token>
Roles:

manager – can view all companies’ progress

user – can view/upload their own documents

# 📡 API Endpoints
Documents
Method	Endpoint	Role	Description
GET	/documents	user/manager	List documents (manager sees catalog only, user sees own uploads)
GET	/documents/download/:docId	user/manager	Download a document file
PUT	/documents/:docId	user	Update document review status
Uploads
Method	Endpoint	Role	Description
POST	/users/userUpload	user	Upload a document file (Multer)
Manager Progress
Method	Endpoint	Role	Description
GET	/documents/manager/progress	manager	View progress of all companies, including missing required docs & weighted completion

# 📂 File Uploads

multer handles file parsing and storage.

upload to Supabase storage

Uploaded file paths are stored in the userdocuments table.

# 📊 Progress Tracking
Missing required documents: counts required docs without uploads.

Weighted completion percentage: (sum of weights of uploaded docs) / (total weight) * 100.

Manager endpoint aggregates these per company.

# 🛠 Development Notes
Ensure your DB schema matches the queries in routes/.

Add indexes/constraints for performance and UPSERT support.

Handle file cleanup if replacing/deleting uploads.

# 📜 License
This project is licensed under the MIT License — see the LICENSE file for details.