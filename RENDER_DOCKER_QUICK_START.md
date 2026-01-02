# Quick Start: Render Docker Deployment

## TL;DR - Create New Render Web Service

1. **Go to Render** → **New +** → **Web Service**
2. **Connect your GitHub repo**
3. **Configure:**
   - **Name**: `kiwi-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Docker` ⚠️ (not Python!)
   - **Dockerfile Path**: `Dockerfile` (or `backend/Dockerfile` if root is repo root)
   - **Health Check Path**: `/health`
4. **Environment Variables:**
   ```
   PORT=5001
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```
5. **Create Service** → Wait for build (5-10 min)
6. **Copy Render URL** → Update Vercel `NEXT_PUBLIC_EC2_IP`

## Key Differences from Python Deployment

| Setting | Python | Docker |
|--------|--------|-------|
| Environment | Python 3 | Docker |
| Root Directory | `backend` | `backend` |
| Build Command | `pip install -r requirements.txt && python -m playwright install chromium` | (automatic) |
| Start Command | `python server.py` | (automatic, from Dockerfile) |
| Playwright Browsers | Installed at runtime | Installed during build |

## Why Docker?

✅ **More Reliable**: Browsers installed during build, not runtime
✅ **Faster Cold Starts**: No need to install browsers on first request
✅ **Consistent**: Same environment everywhere
✅ **Easier Debugging**: Can test Docker image locally

## Files Created

- `backend/Dockerfile` - Docker image definition
- `backend/.dockerignore` - Files to exclude from Docker build
- `RENDER_DOCKER_DEPLOYMENT.md` - Full deployment guide

## Next Steps

See `RENDER_DOCKER_DEPLOYMENT.md` for detailed instructions and troubleshooting.

