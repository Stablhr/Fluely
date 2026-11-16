import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import {env} from './api/config/env';
import routes from './api/routes/index';
import {errorHandler} from './api/middleware/errorHandler';
import {sanitize} from './api/middleware/sanitize';
import {requestLogger} from './api/middleware/requestLogger';
import {csrfProtection} from './api/middleware/csrf';
import {httpsRedirect} from './api/middleware/httpsRedirect';
import {notFoundHandler} from './api/middleware/notFound';
import {socialPublishRoutes} from './api/routes/social.routes';

const app = express();

// On Vercel every request arrives through one proxy hop, and Vercel overwrites
// `X-Forwarded-For` with the real client address. Trusting that one hop makes
// `req.ip` the client rather than the proxy, which the rate limiters key on.
if (process.env.VERCEL === '1') {
  app.set('trust proxy', 1);
}

const allowedOrigins = env.CORS_ORIGINS
  ? env.CORS_ORIGINS.split(',').map(o => o.trim().replace(/\/+$/, ''))
  : ['http://localhost:3000', 'https://fluely.vercel.app'];

  
app.use(helmet());
app.use(httpsRedirect);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-csrf-token']
  })
);

// QStash deliveries are verified by signature over the raw body, so they are
// routed before JSON parsing and CSRF (a server-to-server call has no cookie).
app.use('/api/social-publish', socialPublishRoutes);
// Social posts carry captions and media metadata, and the one-time import
// sends a browser's whole post list; everything else stays at 10kb.
app.use('/api/social-posts', express.json({limit: '2mb'}));
app.use(express.json({limit: '10kb'}));
app.use(cookieParser());
app.use(sanitize);
app.use(requestLogger);
app.use(csrfProtection);

app.use('/api', routes);

app.get('/', async (_req, res) => {
  res.send('test production!');
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
