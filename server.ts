import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { SESSION_ACCOUNTS, UNIVERSITY_DB } from './src/domain/mockDatabase';
import {
  buildStudentDormitoryGraph,
  getAuthorizedRoomDetails,
  getAuthorizedStudentDetails,
  resolveAuthenticatedStudent,
} from './src/domain/graphEngine';
import {
  addSkillEdge,
  addSkillNode,
  attachDomainToStudent,
  deleteSkillEdge,
  deleteSkillNode,
  detachDomainFromStudent,
  getStudentSkillGraphDto,
  getSystemDomains,
  resetStudentSkillGraph,
  saveGraphLayout,
  updateSkillNode,
} from './src/domain/skillGraphEngine';

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

  /* =========================================================================
   * Version 2.0: Student Visual Skills & Talent Graph Endpoints (SeeNodes)
   * ========================================================================= */

  // Auth helper for skills endpoints
  const requireStudentAuth = (req: Request, res: Response): string | null => {
    const token = extractBearerToken(req);
    const auth = resolveAuthenticatedStudent(UNIVERSITY_DB, token);
    if (!auth.data) {
      res.status(auth.httpStatus).json({
        errorCode: auth.errorCode,
        message: auth.message,
      });
      return null;
    }
    return auth.data.id;
  };

  // GET /api/v1/graph/skills/me - Fetch authenticated student's visual skills graph
  app.get(['/api/v1/graph/skills/me', '/api/graph/skills/me'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    try {
      const graph = getStudentSkillGraphDto(studentId);
      res.status(200).json(graph);
    } catch (err: any) {
      res.status(500).json({ errorCode: 'SKILLS_FETCH_FAILED', message: err.message });
    }
  });

  // POST /api/v1/graph/skills/nodes - Create a new skill / festival / project box
  app.post(['/api/v1/graph/skills/nodes', '/api/graph/skills/nodes'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    const { title, nodeType, subtitle, category, proficiencyLevel, position, notes } = req.body;
    if (!title || !nodeType) {
      res.status(400).json({
        errorCode: 'INVALID_INPUT',
        message: 'عنوان و نوع گره برای ایجاد جعبه مهارت الزامی است.',
      });
      return;
    }

    try {
      const createdNode = addSkillNode(studentId, {
        title,
        nodeType,
        subtitle,
        category,
        proficiencyLevel,
        position,
        notes,
      });
      res.status(201).json(createdNode);
    } catch (err: any) {
      res.status(500).json({ errorCode: 'NODE_CREATION_FAILED', message: err.message });
    }
  });

  // PUT /api/v1/graph/skills/nodes/:nodeId - Update position, metadata, or proficiency
  app.put(['/api/v1/graph/skills/nodes/:nodeId', '/api/graph/skills/nodes/:nodeId'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    const { nodeId } = req.params;
    try {
      const updatedNode = updateSkillNode(studentId, nodeId, req.body);
      res.status(200).json(updatedNode);
    } catch (err: any) {
      res.status(404).json({ errorCode: 'NODE_UPDATE_FAILED', message: err.message });
    }
  });

  // DELETE /api/v1/graph/skills/nodes/:nodeId - Remove a node and its connections
  app.delete(['/api/v1/graph/skills/nodes/:nodeId', '/api/graph/skills/nodes/:nodeId'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    const { nodeId } = req.params;
    try {
      const result = deleteSkillNode(studentId, nodeId);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ errorCode: 'NODE_DELETE_FAILED', message: err.message });
    }
  });

  // POST /api/v1/graph/skills/edges - Connect two boxes with a relation
  app.post(['/api/v1/graph/skills/edges', '/api/graph/skills/edges'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    const { source, target, relationType, label } = req.body;
    if (!source || !target) {
      res.status(400).json({
        errorCode: 'INVALID_INPUT',
        message: 'مبدأ و مقصد برای ایجاد ارتباط بین گره‌ها الزامی است.',
      });
      return;
    }

    try {
      const edge = addSkillEdge(studentId, { source, target, relationType, label });
      res.status(201).json(edge);
    } catch (err: any) {
      res.status(400).json({ errorCode: 'EDGE_CREATION_FAILED', message: err.message });
    }
  });

  // DELETE /api/v1/graph/skills/edges/:edgeId - Remove a connection edge
  app.delete(['/api/v1/graph/skills/edges/:edgeId', '/api/graph/skills/edges/:edgeId'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    const { edgeId } = req.params;
    try {
      const result = deleteSkillEdge(studentId, edgeId);
      res.status(200).json(result);
    } catch (err: any) {
      res.status(400).json({ errorCode: 'EDGE_DELETE_FAILED', message: err.message });
    }
  });

  // POST /api/v1/graph/skills/reset - Reset to initial registration state
  app.post(['/api/v1/graph/skills/reset', '/api/graph/skills/reset'], (req: Request, res: Response) => {
    const studentId = requireStudentAuth(req, res);
    if (!studentId) return;

    try {
      const resetGraph = resetStudentSkillGraph(studentId);
      res.status(200).json(resetGraph);
    } catch (err: any) {
      res.status(500).json({ errorCode: 'RESET_FAILED', message: err.message });
    }
  });

  // 14.2 GET /api/skills/domains (and /api/v1/skills/domains) - Fetch all active university domains
  app.get(['/api/skills/domains', '/api/v1/skills/domains'], (_req: Request, res: Response) => {
    res.status(200).json(getSystemDomains());
  });

  // 14.3 POST /api/graph/skills/me/domains - Attach an official domain to student profile
  app.post(
    ['/api/graph/skills/me/domains', '/api/v1/graph/skills/me/domains'],
    (req: Request, res: Response) => {
      const studentId = requireStudentAuth(req, res);
      if (!studentId) return;

      const { domainId, relationKind } = req.body;
      if (!domainId) {
        res.status(400).json({ errorCode: 'MISSING_DOMAIN_ID', message: 'شناسه حوزه الزامی است.' });
        return;
      }

      try {
        const domainNode = attachDomainToStudent(studentId, domainId, relationKind);
        res.status(201).json(domainNode);
      } catch (err: any) {
        res.status(400).json({ errorCode: 'DOMAIN_ATTACH_FAILED', message: err.message });
      }
    }
  );

  // 14.4 DELETE /api/graph/skills/me/domains/:domainId - Detach domain from student profile
  app.delete(
    ['/api/graph/skills/me/domains/:domainId', '/api/v1/graph/skills/me/domains/:domainId'],
    (req: Request, res: Response) => {
      const studentId = requireStudentAuth(req, res);
      if (!studentId) return;

      try {
        const result = detachDomainFromStudent(studentId, req.params.domainId);
        res.status(200).json(result);
      } catch (err: any) {
        res.status(400).json({ errorCode: 'DOMAIN_DETACH_FAILED', message: err.message });
      }
    }
  );

  // 14.9 PUT /api/graph/skills/me/layout - Save custom layout positions
  app.put(
    ['/api/graph/skills/me/layout', '/api/v1/graph/skills/me/layout'],
    (req: Request, res: Response) => {
      const studentId = requireStudentAuth(req, res);
      if (!studentId) return;

      const { positions } = req.body;
      if (!Array.isArray(positions)) {
        res.status(400).json({ errorCode: 'INVALID_POSITIONS', message: 'آرایه موقعیت‌ها الزامی است.' });
        return;
      }

      try {
        const result = saveGraphLayout(studentId, positions);
        res.status(200).json(result);
      } catch (err: any) {
        res.status(500).json({ errorCode: 'LAYOUT_SAVE_FAILED', message: err.message });
      }
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
