import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SESSION_ACCOUNTS, UNIVERSITY_DB } from './src/domain/mockDatabase';
import {
  buildStudentDormitoryGraph,
  getAuthorizedRoomDetails,
  getAuthorizedStudentDetails,
} from './src/domain/graphEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractBearerToken(req: Request): string | undefined {
  const authHeader = req.header('authorization');
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // NFR-05: Safe private cache control varied by Authorization header
  app.use('/api', (_req, res, next) => {
    res.setHeader('Vary', 'Authorization, X-Simulate-Service-Unavailable');
    res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
    next();
  });

  // Available demo sessions endpoint (Zero sensitive PII exposed)
  app.get(['/api/v1/auth/sessions', '/api/auth/sessions'], (_req: Request, res: Response) => {
    res.status(200).json(SESSION_ACCOUNTS);
  });

  // FR-11, AT-07, AT-08: Reject any mutating method on the Read-Only Dormitory Graph API
  app.all(['/api/v1/graph/dormitory/*', '/api/graph/dormitory/*'], (req: Request, res: Response, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(403).json({
        errorCode: 'READ_ONLY_MODULE',
        message:
          'ماژول گراف خوابگاه صرفاً نمایشی (فقط‌خواندنی) است. ایجاد، ویرایش یا حذف گره‌ها و ارتباطات مجاز نیست.',
      });
      return;
    }
    next();
  });

  // 12.1 GET /api/v1/graph/dormitory/me (and /api/graph/dormitory/me)
  app.get(['/api/v1/graph/dormitory/me', '/api/graph/dormitory/me'], (req: Request, res: Response) => {
    // AT-14 / 12.4: Optional simulated backend data source outage
    if (req.header('x-simulate-service-unavailable') === '1') {
      res.status(503).json({
        errorCode: 'SOURCE_UNAVAILABLE',
        message: 'دریافت اطلاعات خوابگاه با مشکل مواجه شد. لطفاً دوباره تلاش کنید.',
      });
      return;
    }

    // Section 6.3 & AT-09: Reject attempts to pass studentId in query string
    if (typeof req.query.studentId === 'string' && req.query.studentId.trim().length > 0) {
      res.status(403).json({
        errorCode: 'QUERY_IDENTITY_FORBIDDEN',
        message:
          'شما مجوز مشاهده این اطلاعات را ندارید. شناسه دانشجو نباید در پارامتر درخواست ارسال شود و صرفاً از نشست معتبر استخراج می‌گردد.',
      });
      return;
    }

    const token = extractBearerToken(req);
    const result = buildStudentDormitoryGraph(UNIVERSITY_DB, token);

    if (!result.data) {
      res.status(result.httpStatus).json({
        errorCode: result.errorCode,
        message: result.message,
      });
      return;
    }

    res.status(result.httpStatus).json(result.data);
  });

  // 12.2 GET /api/v1/graph/dormitory/rooms/:roomId
  app.get(
    ['/api/v1/graph/dormitory/rooms/:roomId', '/api/graph/dormitory/rooms/:roomId'],
    (req: Request, res: Response) => {
      const token = extractBearerToken(req);
      const result = getAuthorizedRoomDetails(UNIVERSITY_DB, token, String(req.params.roomId));

      if (!result.data) {
        res.status(result.httpStatus).json({
          errorCode: result.errorCode,
          message: result.message,
        });
        return;
      }

      res.status(result.httpStatus).json(result.data);
    }
  );

  // 12.3 GET /api/v1/graph/dormitory/students/:studentId
  app.get(
    ['/api/v1/graph/dormitory/students/:studentId', '/api/graph/dormitory/students/:studentId'],
    (req: Request, res: Response) => {
      const token = extractBearerToken(req);
      const result = getAuthorizedStudentDetails(
        UNIVERSITY_DB,
        token,
        String(req.params.studentId)
      );

      if (!result.data) {
        res.status(result.httpStatus).json({
          errorCode: result.errorCode,
          message: result.message,
        });
        return;
      }

      res.status(result.httpStatus).json(result.data);
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`University Graph - Dormitory Module listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
