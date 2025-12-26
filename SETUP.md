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

Uploaded images are stored in AWS S3. The S3 URL is stored in MongoDB.

### AWS S3 Configuration

The following environment variables need to be set in a `.env` file:

```
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=your_aws_region (e.g., us-east-1)
AWS_S3_BUCKET_NAME=your_bucket_name
```

**Important:** Your S3 bucket needs to be configured for public read access and CORS. Follow these steps:

### 1. Bucket Policy (Public Read Access)

Go to your S3 bucket → Permissions → Bucket Policy and add:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*"
    }
  ]
}
```

Replace `YOUR_BUCKET_NAME` with your actual bucket name.

### 2. Block Public Access Settings

Go to Permissions → Block public access and ensure:
- **Uncheck** "Block all public access" OR
- Keep it checked but ensure the bucket policy above allows public reads

### 3. CORS Configuration

Go to Permissions → Cross-origin resource sharing (CORS) and add:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

This allows your frontend to load images from S3.

## Database

MongoDB Atlas connection is configured in `app.module.ts`. The database name is `livewall`.

## CORS

CORS is enabled for `http://localhost:3000` and `http://localhost:3001` to allow frontend connections.

