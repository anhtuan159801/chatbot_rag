# Deployment Guide for RAGBot Admin Console

This guide provides detailed instructions for deploying the RAGBot Admin Console to various platforms: Render, Vercel, and Koyeb.

## Prerequisites

Before deploying, ensure you have:
- A Google Gemini API key
- (Optional) Facebook Page ID and Access Token for Facebook integration
- A GitHub repository with your code

## Deployment to Render

### 1. Prepare Your Repository
- Push your code to a GitHub repository
- Ensure your `package.json` has the correct start script: `"start": "node server.js"`

### 2. Create a Render Web Service
1. Go to [https://render.com](https://render.com) and sign in
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the build and deployment settings:
   - **Environment**: Node
   - **Build Command**: `npm run build` (or `npm install`)
   - **Start Command**: `npm start`
   - **Region**: Choose your preferred region

### 3. Configure Environment Variables
In the Render dashboard, go to your service settings and add:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `PORT`: Leave blank (Render sets this automatically)

### 4. Environment-Specific Settings
Render automatically handles the PORT variable, but your app is configured to use it properly.

### 5. Health Check Configuration
Render will automatically detect your health check endpoint at `/health`. You can set this in your service settings if needed.

### 6. Deploy
- Click "Create Web Service"
- Render will automatically build and deploy your application
- The sleep prevention mechanism (health check endpoints) will keep your app active

## Deployment to Vercel

### 1. Prepare Your Application for Vercel
Vercel is primarily designed for frontend applications, but you can deploy Node.js backends using Vercel Functions or by configuring it properly. However, since your app is a full-stack application with a custom server, you'll need to make some adjustments.

### 2. Create a Vercel Configuration
Create a `vercel.json` file in your project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

### 3. Alternative: Frontend Build Only
If you want to serve only the frontend and host the API separately:
1. Remove the Express server code from your build process
2. Update API calls to point to your external backend
3. Use Vercel's static site deployment

### 4. Deploy to Vercel
1. Go to [https://vercel.com](https://vercel.com) and sign in
2. Click "New Project" and import your GitHub repository
3. In the project settings, configure:
   - **Framework Preset**: Other (or select based on your configuration)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist` (or your build output directory)
4. Add environment variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key

### 5. Note on Sleep Prevention
Vercel's serverless functions have different sleep behavior than traditional servers. The health check endpoints will work differently in this context.

## Deployment to Koyeb

### 1. Prepare Your Repository
- Push your code to a GitHub repository
- Ensure your `package.json` has the correct start script: `"start": "node server.js"`

### 2. Create a Koyeb Account
1. Go to [https://koyeb.com](https://koyeb.com) and sign up
2. Install the Koyeb CLI or use the web dashboard

### 3. Deploy Using Koyeb Dashboard
1. Click "Create App"
2. Select GitHub as your source
3. Choose your repository
4. Configure the deployment:
   - **Runtime**: Node.js
   - **Build Command**: `npm install && npm run build`
   - **Run Command**: `npm start`
   - **Port**: `PORT` environment variable

### 4. Configure Environment Variables
In the Koyeb dashboard, under your service settings, add:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `PORT`: Koyeb will set this automatically, but you can specify if needed

### 5. Health Check Configuration
Koyeb supports health checks. Configure your health check endpoint as:
- **Path**: `/health`
- **Port**: Your app port (typically 8080, but set by Koyeb)

### 6. Sleep Prevention
Your application includes built-in mechanisms to prevent sleep:
- Health check endpoint at `/health`
- Ping endpoint at `/ping`
- Keep-alive interval that logs every 5 minutes
- Set up a periodic service or external ping service to call `/ping` every few minutes to keep the app active

## Post-Deployment Configuration

### Facebook Integration
After deployment, configure your Facebook integration:
1. Go to your deployed application's Settings page
2. Enter your Facebook Page ID and Access Token
3. Configure the webhook URL in your Facebook App Dashboard:
   - Callback URL: `https://YOUR_APP_URL/webhooks/facebook`
   - Verify Token: `dvc_verify_token_2024_secure` (or your custom token)

### SSL/HTTPS
All platforms will automatically provide SSL certificates for HTTPS access.

## Troubleshooting Common Issues

### 1. Application Going to Sleep
- **Issue**: App becomes unresponsive after periods of inactivity
- **Solution**: Set up an external service (like UptimeRobot) to ping your `/health` or `/ping` endpoint every 5-10 minutes

### 2. Environment Variables Not Loading
- **Issue**: API keys not working after deployment
- **Solution**: Verify environment variables are set in your platform's dashboard, not just in local `.env` file

### 3. Build Failures
- **Issue**: Deployment fails during build process
- **Solution**: 
  - Check your build commands match your package.json scripts
  - Ensure all dependencies are listed in package.json
  - Check for platform-specific compatibility issues

### 4. Port Configuration
- **Issue**: App doesn't start on deployment platform
- **Solution**: Ensure your app uses the `PORT` environment variable provided by the platform

## Performance Considerations

### 1. Asset Optimization
- Your app is configured with Tailwind CSS via CDN
- Optimize images before uploading to the knowledge base
- Consider implementing image compression for uploads

### 2. API Rate Limiting
- Be mindful of Gemini API usage limits
- Consider implementing request caching for repeated queries
- Monitor API usage in your Google Cloud Console

### 3. Database Considerations
- Currently using localStorage for data persistence
- For production, consider implementing a proper database solution
- Plan for data backup and recovery procedures

## Security Best Practices

### 1. API Key Security
- Never commit API keys to version control
- Use environment variables exclusively
- Rotate keys periodically
- Monitor API usage for unusual patterns

### 2. User Data Protection
- All sensitive data is stored in localStorage (client-side)
- Consider implementing server-side storage for sensitive information
- Implement proper access controls for admin functions

### 3. Regular Updates
- Keep dependencies updated
- Monitor security advisories for your tech stack
- Regularly review and update security configurations

## Monitoring and Maintenance

### 1. Health Monitoring
- Use the `/health` endpoint to monitor application status
- Set up external monitoring services to check uptime
- Monitor response times and error rates

### 2. Logs
- Check platform-specific logs for debugging
- Implement structured logging for easier analysis
- Set up alerts for critical errors

### 3. Backup Strategy
- Regularly backup localStorage data (if critical)
- Maintain version control for configuration changes
- Document deployment procedures for team members

Your RAGBot Admin Console is now ready for deployment on any of these platforms with the proper configuration!