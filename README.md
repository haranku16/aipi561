# Duke University AIPI561 – Operationalizing AI

## Overview

This repository is a monorepo for the Duke University AIPI561 course "Operationalizing AI." The project's goal is to build and operationalize an end-to-end AI application that provides an intelligent photo album experience. Users can upload photos, which are automatically analyzed using AI to generate descriptions, and then search through their photos using natural language queries.

## Design

### Architecture Overview

- **Frontend (SvelteKit):**
  - Modern web application deployed on Vercel
  - Google OAuth 2.0 authentication
  - Photo upload and gallery interface
  - Natural language search interface
  - Real-time photo processing status updates

- **Backend (Deno):**
  - RESTful API service
  - Google OAuth token validation and user info retrieval
  - Photo upload coordination with S3
  - DynamoDB record management
  - Integration with AWS OpenSearch for semantic search

- **Infrastructure (AWS):**
  - S3 for photo storage
  - DynamoDB for photo metadata and descriptions
  - Lambda for async photo processing using OpenAI o4-mini
  - OpenSearch for semantic search capabilities
  - CloudWatch for monitoring and logging
  - CloudFormation/CDK for infrastructure as code

### API Specifications

- **Authentication APIs:**
  - `GET /api/auth/user` - Retrieve authenticated user information (name, email)
  - Uses Google OAuth 2.0 tokens passed from SvelteKit server

- **Photo Management APIs:**
  - `POST /api/photos/upload` - Upload a new photo
    - Accepts multipart/form-data with photo file
    - Returns upload status and photo ID
  - `GET /api/photos` - List user's photos
    - Supports pagination and basic filtering
    - Returns photo metadata including AI-generated descriptions
  - `GET /api/photos/{id}` - Get specific photo details
    - Returns full photo metadata and processing status

- **Search API:**
  - `GET /api/photos/search` - Semantic search across photos
    - Query parameter for natural language search
    - Returns matching photos with relevance scores
    - Leverages OpenSearch for AI-powered search

### Frontend/Backend Interaction

- **Authentication Flow:**
  1. User authenticates via Google OAuth in SvelteKit
  2. SvelteKit server validates token and passes to backend
  3. Backend verifies token and retrieves user info from Google
  4. User info cached in session for subsequent requests

- **Photo Upload Flow:**
  1. User uploads photo through SvelteKit frontend
  2. Frontend calls backend upload API
  3. Backend stores photo in S3 and creates DynamoDB record
  4. Lambda triggered to process photo with OpenAI o4-mini
  5. DynamoDB record updated with AI description
  6. OpenSearch index updated for search capabilities

- **Search Flow:**
  1. User enters natural language query
  2. Frontend calls search API
  3. Backend queries OpenSearch
  4. Results returned with relevance scores
  5. Frontend displays matching photos

## Local Development and Deployment

### Prerequisites

- Node.js (v18 or later)
- Deno (latest version)
- Docker and Docker Compose
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS CLI configured with appropriate credentials

### Local Backend Development

#### Using Deno

Run the backend server:

```bash
cd backend
deno task start --allow-net --allow-env --allow-read --allow-run --allow-sys --allow-import
```

The server will start on `http://localhost:8000` by default.

#### Using Docker

1. Build and start the backend services:
```bash
cd backend
docker build -t aipi561backend .
docker run -it -p 8000:8000 aipi561backend
```

This will start the backend server as a container.

### Local CDK Deployment

1. Install dependencies:
```bash
cd infrastructure
npm install
```

2. Bootstrap your AWS environment (first time only):
```bash
npx cdk bootstrap
```

3. Deploy all stacks:
```bash
npx cdk deploy --all
```

To destroy the deployed resources:
```bash
npx cdk destroy --all
```
