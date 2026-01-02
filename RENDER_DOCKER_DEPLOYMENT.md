# Deploying Kiwi Backend to Render with Docker

This guide walks you through deploying the Kiwi backend to Render using Docker, which provides better consistency and easier Playwright browser management.

## Prerequisites

- A GitHub repository with your Kiwi code
- A Render account (sign up at [render.com](https://render.com))
- Your Vercel frontend URL (for CORS configuration)

## Step 1: Create a New Web Service on Render

1. **Go to Render Dashboard**
   - Sign in to [render.com](https://render.com)
   - Click **"New +"** → **"Web Service"**

2. **Connect Your Repository**
   - Click **"Connect account"** if you haven't connected GitHub yet
   - Select your repository
   - Click **"Connect"**

3. **Configure the Service**

   **Basic Settings:**
   - **Name**: `kiwi-backend` (or your preferred name)
   - **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend` ⚠️ **Important**: Set this to `backend` since your Dockerfile is in the backend folder

   **Build & Deploy:**
   - **Environment**: `Docker` ⚠️ **Important**: Select "Docker" instead of "Python"
   - **Dockerfile Path**: `backend/Dockerfile` (or just `Dockerfile` if root directory is `backend`)
   - **Docker Context**: `backend` (or `.` if root directory is `backend`)
   - **Build Command**: Leave empty (Docker handles this automatically)
   - **Start Command**: Leave empty (defined in Dockerfile CMD)

   **Health Check:**
   - **Health Check Path**: `/health`
   - **Health Check Interval**: `30` seconds

4. **Set Environment Variables**

   Click **"Environment"** tab and add:

   ```
   PORT=5001
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   ```

   ⚠️ **Important Notes:**
   - Replace `your-vercel-app.vercel.app` with your actual Vercel URL
   - **No trailing slash** in the URL
   - If you have multiple origins, separate with commas: `https://app1.vercel.app,https://app2.vercel.app`
   - **No `http://` or `https://` prefix needed** - Render will handle the protocol

5. **Advanced Settings (Optional)**
   - **Auto-Deploy**: `Yes` (deploys on every push to main branch)
   - **Plan**:
     - **Free**: Good for testing, but has cold starts
     - **Starter ($7/month)**: Recommended for production (no cold starts, better performance)

6. **Create the Service**

   Click **"Create Web Service"** at the bottom.

## Step 2: Wait for First Deployment

- Render will automatically:
  1. Build the Docker image
  2. Install all dependencies (including Playwright browsers)
  3. Start the service

- **First build takes 5-10 minutes** (installing Playwright browsers is slow)
- Watch the build logs to ensure everything completes successfully

## Step 3: Get Your Render URL

Once deployed, Render will provide a URL like:

```
https://kiwi-backend.onrender.com
```

Copy this URL (without `https://`).

## Step 4: Update Vercel Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Update `NEXT_PUBLIC_EC2_IP`:
   - Value: `kiwi-backend.onrender.com` (just the domain, no `https://`)
4. Click **"Save"**
5. **Redeploy** your Vercel app (go to Deployments → ... → Redeploy)

## Step 5: Test the Deployment

1. **Test Health Endpoint:**

   ```bash
   curl https://kiwi-backend.onrender.com/health
   ```

   Should return: `{"status":"healthy",...}`

2. **Test from Frontend:**
   - Go to your Vercel app
   - Try creating/running a test
   - Check browser console and network tab for errors

## Troubleshooting

### Build Fails

**Error: "Playwright browsers not found"**

- The Dockerfile installs browsers during build, so this shouldn't happen
- Check build logs to see if `playwright install chromium` completed

**Error: "Port already in use"**

- Ensure `PORT` environment variable is set to `5001` in Render
- The Dockerfile uses `${PORT:-5001}` as fallback

### Runtime Errors

**Error: "BrowserType.launch: Executable doesn't exist"**

- This shouldn't happen with Docker (browsers are installed in the image)
- If it does, check that the Dockerfile includes `playwright install chromium`

**Error: "CORS error"**

- Verify `ALLOWED_ORIGINS` in Render includes your Vercel URL
- Ensure no trailing slash in the URL
- Check that your Vercel URL matches exactly (including `https://`)

**Error: "500 Internal Server Error"**

- Check Render logs: **Logs** tab in Render dashboard
- Look for Python errors, missing dependencies, or Playwright issues

### Health Check Fails

**Error: "HTTP health check failed"**

- Verify `/health` endpoint works: `curl https://your-backend.onrender.com/health`
- Check that the service is running (not sleeping on free tier)
- Ensure Health Check Path is set to `/health` in Render settings

## Advantages of Docker Approach

✅ **Consistent Environment**: Same environment locally and in production
✅ **Easier Browser Management**: Playwright browsers installed during build
✅ **Better Isolation**: Dependencies are containerized
✅ **Easier Debugging**: Can test Docker image locally before deploying

## Local Docker Testing (Optional)

To test the Docker setup locally:

```bash
cd backend
docker build -t kiwi-backend .
docker run -p 5001:5001 -e PORT=5001 -e ALLOWED_ORIGINS=http://localhost:3000 kiwi-backend
```

Then test:

```bash
curl http://localhost:5001/health
```

## Next Steps

Once your backend is deployed and working:

1. ✅ Verify health endpoint responds
2. ✅ Test creating a test from Vercel frontend
3. ✅ Check Render logs for any errors
4. ✅ Monitor Render dashboard for resource usage

If you encounter any issues, check the Render logs first - they provide detailed error messages.
