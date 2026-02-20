# Full Video Editing App (Frontend + Backend)

This repository now includes a complete starter video editing app with:

- **Frontend**: React + Vite UI for upload, trim, caption overlay, and merge workflows.
- **Backend**: Express + ffmpeg API to process uploaded videos.

## Project structure

- `frontend/` — React application.
- `backend/` — Node.js API with ffmpeg processing.

## Backend setup

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4001`.

### Backend endpoints

- `POST /api/upload` (multipart field name: `video`)
- `POST /api/edit/trim` with `{ fileId, start, duration }`
- `POST /api/edit/text` with `{ fileId, text, x?, y?, fontsize? }`
- `POST /api/edit/merge` with `{ fileIds: ["id1", "id2"] }`

Processed output is available from `/exports/<file>.mp4`.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and points to backend at `http://localhost:4001`.

## Requirements

- Node.js 18+
- `ffmpeg` installed on system PATH (required by `fluent-ffmpeg`)

## Notes

This is production-oriented starter code. For production deployment, add:

- Authentication / per-user ownership checks
- Rate limiting
- Virus scanning and file size/type validation
- Job queue for long-running renders
- Cloud object storage (S3/GCS) for media files
