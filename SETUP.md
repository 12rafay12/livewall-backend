# LiveWall Backend Setup

## Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account (connection string already configured)

## Installation

```bash
npm install
```

## Running the Backend

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The backend will run on `http://localhost:3001`

## API Endpoints

- `POST /api/uploads` - Create a new upload (photo and/or message)
- `GET /api/uploads` - Get all uploads (optional query: `?status=approved`)
- `GET /api/uploads/:id` - Get a specific upload
- `PATCH /api/uploads/:id` - Update upload status (body: `{ "action": "approve" | "reject" | "schedule" }`)
- `PATCH /api/uploads/bulk` - Bulk update status (body: `{ "ids": [...], "action": "approve" | "reject" | "schedule" }`)

## File Storage

Uploaded images are stored in `public/uploads/` directory. The file path is stored in MongoDB.

## Database

MongoDB Atlas connection is configured in `app.module.ts`. The database name is `livewall`.

## CORS

CORS is enabled for `http://localhost:3000` and `http://localhost:3001` to allow frontend connections.

