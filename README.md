# Duke University AIPI561 – Operationalizing AI

## Overview

This repository is a monorepo for the Duke University AIPI561 course "Operationalizing AI." The project's goal is to build and operationalize an end-to-end AI application over six weeks. The application takes a picture of a map (with scale, current location, and compass orientation markers) and overlays the user's live GPS location on that map, ideal for indoor use (e.g., in malls).

## Timeline

- **Week 1:** Ideation. Frontend and API design. Setup branches for frontend and backend development with dev container support.
- **Week 2:** Placeholder backend API hooks deployed via CloudFormation and monitored using CloudWatch, with automated deployment hooks and unit testing.
- **Week 3:** Frontend application implemented using SvelteKit and deployed on Vercel.
- **Week 4:** Map analysis API (using Llama 4.0 multi-modal model) to rescale/reframe the map (e.g., if the user's picture is at an odd angle) and extract map coordinates (current location, scale, and orientation). Includes unit testing, deployment, and monitoring.
- **Week 5:** Auth and user/session management APIs for persisting visited locations (e.g., multiple levels of a mall). Includes unit testing, deployment, and monitoring.
- **Week 6:** Buffer (reserved for final integration, testing, polish, and documentation updates).

## Design

### API Specifications

- **Map Upload API (POST /api/map/upload):**  
  – Accepts a multipart/form-data payload (image file) and optional metadata (e.g., user session).  
  – Returns a JSON response with a map ID (or error details).

- **Map Analysis API (POST /api/map/analyze):**  
  – Input: map ID (or image payload) and (optionally) user's current GPS coordinates.  
  – Output: JSON containing rescaled/reframed map coordinates (current location, scale, and orientation) as computed by the Llama 4.0 multi-modal model.

- **Auth & Session Management APIs:**  
  – (POST /api/auth/login) – Authenticate a user (e.g., via OAuth or JWT).  
  – (GET /api/user/maps) – Retrieve a list of saved maps (or "visited locations") for the authenticated user.

### Frontend/Backend Interaction

- **Frontend (SvelteKit):**  
  – The SvelteKit application (deployed on Vercel) provides a user interface for uploading a map image (via a form or drag-and-drop) and (optionally) capturing the user's GPS location (using the Geolocation API).  
  – On upload, the frontend calls the Map Upload API (POST /api/map/upload) and then triggers the Map Analysis API (POST /api/map/analyze) to overlay the user's live location on the rescaled map.  
  – The frontend also integrates with Auth APIs (e.g., login and fetching saved maps) to persist user sessions and visited locations.

- **Backend (CloudFormation & CloudWatch):**  
  – The backend (deployed via CloudFormation) hosts RESTful API endpoints (e.g., /api/map/upload, /api/map/analyze, /api/auth/login, /api/user/maps).  
  – CloudWatch is used for monitoring (e.g., logging, alarms) and automated deployment hooks (e.g., via AWS CodePipeline) are set up for continuous integration.  
  – Unit tests (e.g., using Jest or pytest) are run as part of the deployment pipeline.

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
