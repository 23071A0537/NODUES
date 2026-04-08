# Deployment Guide - No-Dues Management System

## 📋 Pre-Deployment Checklist

### Backend

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Seed data loaded (admin user, due types, departments)
- [ ] JWT_SECRET is strong and unique (min 32 characters)
- [ ] CORS origins configured for production domain
- [ ] Rate limiting configured
- [ ] SSL/TLS certificates ready
- [ ] Database backup strategy in place
- [ ] Logging configured (consider cloud logging service)

### Frontend

- [ ] API URL points to production backend
- [ ] Build tested locally (`npm run build`)
- [ ] Environment variables set
- [ ] Error tracking configured (optional: Sentry)
- [ ] Analytics configured (optional: Google Analytics)

### Database

- [ ] PostgreSQL instance provisioned
- [ ] Connection pooling configured
- [ ] Automated backups enabled
- [ ] Performance monitoring enabled
- [ ] SSL connection enforced

---

## 🚀 Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend + Database)

#### Backend + Database on Railway

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy PostgreSQL"
   - Wait for database to provision

3. **Get Database Connection String**
   - Click on PostgreSQL service
   - Go to "Connect" tab
   - Copy "Postgres Connection URL"

4. **Deploy Backend**
   - In same project, click "New Service"
   - Select "GitHub Repo"
   - Select your repository
   - Set root directory to `BACKEND`

5. **Configure Environment Variables**

   ```
   DATABASE_URL=<from PostgreSQL service>
   JWT_SECRET=<generate-strong-secret-32-chars-min>
   PORT=3000
   NODE_ENV=production
   FRONTEND_URL=<your-vercel-domain>
   ARCJET_KEY=<your-arcjet-key-optional>
   ```

6. **Run Database Migrations**
   - In Railway dashboard, go to your backend service
   - Open "Deploy" tab
   - Add deployment command:
     ```bash
     npm install && node runAllMigrations.js && npm start
     ```

7. **Seed Initial Data**
   - One-time: Run in Railway's terminal:
     ```bash
     node seeds/addAdminUser.js
     ```

8. **Get Backend URL**
   - Railway will provide a URL like: `your-app.up.railway.app`
   - Note this for frontend configuration

#### Frontend on Vercel

1. **Create Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**
   - Click "New Project"
   - Import your repository
   - Set root directory to `FRONTEND`

3. **Configure Build Settings**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Set Environment Variables**

   ```
   VITE_API_URL=https://your-backend.up.railway.app
   VITE_ENV=production
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Access your app at `your-app.vercel.app`

6. **Custom Domain (Optional)**
   - Go to project settings
   - Add your custom domain
   - Update DNS records as instructed

---

### Option 2: Render (Full Stack)

#### Backend + Database

1. **Create Render Account**
   - Go to [render.com](https://render.com)

2. **Create PostgreSQL Database**
   - New > PostgreSQL
   - Choose region, plan
   - Wait for provisioning
   - Copy Internal/External Database URL

3. **Create Web Service**
   - New > Web Service
   - Connect GitHub repository
   - Set root directory: `BACKEND`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Environment Variables**

   ```
   DATABASE_URL=<from PostgreSQL service>
   JWT_SECRET=<strong-secret>
   NODE_ENV=production
   FRONTEND_URL=<your-frontend-url>
   ```

5. **Deploy**
   - Render auto-deploys on git push
   - Run migrations in Render Shell:
     ```bash
     node runAllMigrations.js
     node seeds/addAdminUser.js
     ```

#### Frontend

1. **Create Static Site**
   - New > Static Site
   - Connect GitHub repository
   - Root directory: `FRONTEND`
   - Build Command: `npm run build`
   - Publish Directory: `dist`

2. **Environment Variables**

   ```
   VITE_API_URL=https://your-backend.onrender.com
   ```

3. **Deploy**
   - Auto-deploys on push

---

### Option 3: DigitalOcean App Platform

1. **Create App**
   - Select GitHub repository
   - Choose "Split" configuration (frontend + backend)

2. **Configure Backend Component**
   - Type: Web Service
   - Source Directory: `/BACKEND`
   - Build Command: `npm install`
   - Run Command: `npm start`
   - HTTP Port: 3000

3. **Configure Database**
   - Add PostgreSQL database component
   - Copy connection details

4. **Backend Environment Variables**

   ```
   DATABASE_URL=${db.DATABASE_URL}
   JWT_SECRET=<secret>
   NODE_ENV=production
   ```

5. **Configure Frontend Component**
   - Type: Static Site
   - Source Directory: `/FRONTEND`
   - Build Command: `npm run build`
   - Output Directory: `dist`

6. **Frontend Environment Variables**
   ```
   VITE_API_URL=${backend.PUBLIC_URL}
   ```

---

### Option 4: AWS (Advanced)

#### Using EC2 + RDS

1. **RDS PostgreSQL**
   - Create RDS PostgreSQL instance
   - Configure security groups
   - Note connection details

2. **EC2 Instance**
   - Launch Ubuntu instance
   - Install Node.js, nginx
   - Clone repository
   - Configure PM2 for process management

3. **Setup Backend**

   ```bash
   cd BACKEND
   npm install
   # Create .env file
   pm2 start server.js --name nodues-api
   pm2 save
   pm2 startup
   ```

4. **Nginx Configuration**

   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Frontend on S3 + CloudFront**
   - Build: `npm run build`
   - Upload `dist/` to S3 bucket
   - Configure CloudFront distribution
   - Set environment variables before build

---

## 🔧 Post-Deployment Tasks

### 1. Verify Deployment

**Backend Health Check:**

```bash
curl https://your-backend-url/api/health
```

**Test Login:**

```bash
curl -X POST https://your-backend-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "loginType": "teacher",
    "email": "admin_1@vnrvjiet.in",
    "password": "admin123"
  }'
```

**Check Database:**

```bash
# In backend terminal/shell
node -e "import { sql } from './config/db.js'; sql\`SELECT COUNT(*) FROM students\`.then(r => console.log(r))"
```

### 2. Change Default Passwords

Login as admin and change:

- Admin password
- All default operator passwords
- Any test student passwords

### 3. Configure Monitoring

**Application Monitoring:**

- Set up error tracking (Sentry, LogRocket)
- Configure uptime monitoring (UptimeRobot, Pingdom)
- Set up performance monitoring (New Relic, DataDog)

**Database Monitoring:**

- Enable query performance insights
- Set up slow query alerts
- Monitor connection pool usage

**Logging:**

- Configure structured logging
- Set up log aggregation (Papertrail, Logtail)
- Create alerts for errors

### 4. Security Hardening

- [ ] Enable HTTPS (SSL/TLS)
- [ ] Configure HSTS headers
- [ ] Set up Web Application Firewall (WAF)
- [ ] Enable DDoS protection
- [ ] Configure rate limiting
- [ ] Set up IP whitelisting for admin (optional)
- [ ] Enable audit logging
- [ ] Regular security updates

### 5. Backup Strategy

**Database Backups:**

- Daily automated backups
- 30-day retention
- Test restore procedure monthly
- Offsite backup storage

**Code Backups:**

- Git repository (already done)
- Environment variables backup (securely)

### 6. Performance Optimization

- [ ] Enable gzip compression
- [ ] Configure CDN for static assets
- [ ] Optimize database indexes
- [ ] Set up caching (Redis optional)
- [ ] Monitor and optimize slow queries
- [ ] Configure connection pooling

---

## 🔄 Continuous Deployment

### GitHub Actions (Example)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - name: Deploy to Railway
        run: |
          npm install -g railway
          railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - name: Build
        run: |
          cd FRONTEND
          npm install
          npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🐛 Troubleshooting Deployment

### Build Fails

**Issue:** npm install fails

- **Solution:** Check Node version, clear npm cache, check package-lock.json

**Issue:** TypeScript errors

- **Solution:** Run `npm run build` locally first, fix all errors

### Database Connection

**Issue:** Cannot connect to database

- **Solution:**
  - Check DATABASE_URL format
  - Verify SSL mode (`?sslmode=require`)
  - Check firewall/security groups
  - Verify database is running

### CORS Errors

**Issue:** Frontend can't connect to backend

- **Solution:**
  - Update CORS configuration in `server.js`
  - Add frontend domain to allowed origins
  - Check HTTPS/HTTP mismatch

### Authentication Issues

**Issue:** JWT verification fails

- **Solution:**
  - Ensure JWT_SECRET matches between environments
  - Check token expiry
  - Verify token format in Authorization header

---

## 📊 Production Checklist

### Before Go-Live

- [ ] All environment variables set correctly
- [ ] Database migrations applied
- [ ] Seed data loaded
- [ ] Default passwords changed
- [ ] HTTPS enabled
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Load testing completed
- [ ] Security audit done
- [ ] Documentation updated
- [ ] Team trained

### After Go-Live

- [ ] Monitor error rates
- [ ] Check application performance
- [ ] Verify database performance
- [ ] Monitor resource usage
- [ ] Check backup success
- [ ] Review logs daily (first week)
- [ ] Gather user feedback
- [ ] Plan for scaling

---

## 📞 Support Resources

- **Railway Docs:** https://docs.railway.app
- **Vercel Docs:** https://vercel.com/docs
- **Render Docs:** https://render.com/docs
- **Neon Docs:** https://neon.tech/docs

---

**🎉 Your No-Dues Management System is now live!**
