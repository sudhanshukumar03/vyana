import { createHash, randomBytes, randomUUID, createCipheriv } from 'crypto';
import { Pool } from 'pg';
import { Request, Response, NextFunction, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { Config } from './config';
import { credentialsSchema } from './schemas';
import { transaction } from './db';
import { rateLimit } from 'express-rate-limit';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { Promise.resolve(handler(req, res)).catch(next); };

export function authServices(pool: Pool, config: Config, disconnectSession: (id: string) => void) {
  async function authenticate(token: string) {
    let payload: JwtPayload;
    try {
      const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: 'healthguard', audience: 'healthguard-web' });
      if (typeof decoded === 'string') throw new Error();
      payload = decoded;
    } catch { throw new HttpError(401, 'Invalid or expired session'); }
    if (typeof payload.exp !== 'number' || !payload.sub || !/^\d{1,10}$/.test(payload.sub) || !z.uuid().safeParse(payload.sid).success) throw new HttpError(401, 'Invalid session');
    const { rows } = await pool.query(`SELECT u.id,u.email,s.id AS session_id FROM users u JOIN sessions s ON s.user_id=u.id
      WHERE u.id=$1 AND s.id=$2 AND NOT u.disabled AND s.revoked_at IS NULL AND s.expires_at>NOW()`, [payload.sub, payload.sid]);
    if (!rows[0]) throw new HttpError(401, 'Invalid or expired session');
    return { ...rows[0], expires: payload.exp! * 1000 } as { id: number; email: string; session_id: string; expires: number };
  }
  const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    authenticate(token).then((user) => { res.locals.user = user; next(); }).catch(next);
  };
  const deviceMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['x-device-key'];
    if (typeof key !== 'string' || key.length < 32) return next(new HttpError(401, 'Device credential required'));
    pool.query('SELECT * FROM devices WHERE credential_hash=$1 AND revoked_at IS NULL', [digest(key)])
      .then(({ rows }) => {
        if (!rows[0]) throw new HttpError(401, 'Unknown or revoked device');
        res.locals.device = rows[0]; next();
      }).catch(next);
  };
  const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'strict' as const, path: '/api/v1/auth' };
  const cookieToken = (req: Request) => {
    const cookie = req.headers.cookie?.split(';').find((part) => part.trim().startsWith('hg_refresh='));
    return cookie ? cookie.trim().slice('hg_refresh='.length) : '';
  };
  const sign = (user: { id: number; email: string }, sid: string) => jwt.sign({ sid, email: user.email }, config.jwtSecret,
    { algorithm: 'HS256', subject: String(user.id), issuer: 'healthguard', audience: 'healthguard-web', expiresIn: '15m' });
  async function issue(user: { id: number; email: string }, res: Response) {
    const token = randomToken(), sid = randomUUID();
    await pool.query("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 days')", [sid,user.id,digest(token)]);
    res.cookie('hg_refresh', token, { ...cookieOptions, maxAge: 30 * 86400000 });
    return { token: sign(user, sid), user: { id: user.id, email: user.email } };
  }
  function encrypt(payload: object) {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(config.internalSecret).digest(), iv);
    const bytes = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64');
  }
  async function queueToken(userId: number, purpose: 'reset' | 'verify') {
    const token = randomToken();
    await transaction(pool, async (client) => {
      await client.query('DELETE FROM account_tokens WHERE user_id=$1 AND purpose=$2', [userId,purpose]);
      await client.query("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')", [digest(token),userId,purpose]);
      await client.query('INSERT INTO delivery_outbox(user_id,purpose,encrypted_payload) VALUES($1,$2,$3)', [userId,purpose,encrypt({token,purpose})]);
    });
  }
  const router = Router();
  router.post('/register', asyncRoute(async (req,res) => {
    if (config.production || config.publicRegistration) throw new HttpError(503, 'Public registration requires a configured verification delivery provider. Use closed local provisioning.');
    const input = credentialsSchema.parse(req.body);
    const hash = await bcrypt.hash(input.password, 12);
    const { rows } = await pool.query('INSERT INTO users(email,password_hash,email_verified) VALUES($1,$2,TRUE) ON CONFLICT(email) DO NOTHING RETURNING id,email', [input.email,hash]);
    if (!rows[0]) throw new HttpError(409,'Unable to create account with these details');
    res.status(201).json(await issue(rows[0], res));
  }));
  const accountLimit=rateLimit({windowMs:15*60000,limit:10,skipSuccessfulRequests:true,
    keyGenerator:req=>digest(String(req.body?.email||'').trim().toLowerCase().slice(0,255)),
    standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many failed sign-in attempts. Retry later.'}});
  router.post('/login', accountLimit, asyncRoute(async (req,res) => {
    const input = credentialsSchema.parse(req.body);
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [input.email]);
    const user = rows[0];
    const valid = await bcrypt.compare(input.password, user?.password_hash || '$2b$12$MvLFlqSXif.GFMg3i0OZL.WP1gEKo0YpmLIPZ1lQ/54YdT6cJcZ2G');
    if (!user || !valid || user.disabled || ((config.production || config.publicRegistration) && !user.email_verified)) throw new HttpError(401,'Invalid email or password');
    res.json(await issue(user, res));
  }));
  router.post('/refresh', asyncRoute(async (req,res) => {
    if (req.headers['x-healthguard-client'] !== 'web') throw new HttpError(403,'Client header required');
    const token = cookieToken(req);
    const replacement = randomToken();
    const session = await transaction(pool, async (client) => {
      const { rows } = await client.query(`SELECT s.*,u.email FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>NOW() AND NOT u.disabled FOR UPDATE OF s`, [digest(token)]);
      if (!rows[0]) throw new HttpError(401,'Session expired. Sign in again.');
      await client.query("UPDATE sessions SET token_hash=$1,expires_at=NOW()+INTERVAL '30 days' WHERE id=$2", [digest(replacement),rows[0].id]);
      return rows[0];
    });
    res.cookie('hg_refresh',replacement,{...cookieOptions,maxAge:30*86400000});
    res.json({token:sign({id:session.user_id,email:session.email},session.id),user:{id:session.user_id,email:session.email}});
  }));
  router.post('/logout', asyncRoute(async (req,res) => {
    if (req.headers['x-healthguard-client'] !== 'web') throw new HttpError(403,'Client header required');
    // Clear the browser credential even when server-side revocation cannot reach the DB.
    res.clearCookie('hg_refresh',cookieOptions);
    let sid: string | null=null;
    const bearer=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
    if(bearer) {
      try {
        // A signed expired access token may revoke its session, never read data.
        // This closes logout vs. refresh races when the access token has just expired.
        const payload=jwt.verify(bearer,config.jwtSecret,{algorithms:['HS256'],issuer:'healthguard',audience:'healthguard-web',ignoreExpiration:true});
        if(typeof payload!=='string' && z.uuid().safeParse(payload.sid).success) sid=payload.sid;
      } catch { /* The cookie credential can still revoke its matching session. */ }
    }
    const { rows } = await pool.query('UPDATE sessions SET revoked_at=NOW() WHERE token_hash=$1 OR id=$2 RETURNING id', [digest(cookieToken(req)),sid]);
    rows.forEach((row) => disconnectSession(row.id));
    res.json({ success: true });
  }));
  router.get('/me', userMiddleware, (req,res) => res.json({user: {id:res.locals.user.id,email:res.locals.user.email}}));
  router.post('/request-reset', asyncRoute(async (req,res) => {
    const { email } = z.object({email:z.email().max(255)}).parse(req.body);
    const { rows } = await pool.query('SELECT id FROM users WHERE email=$1 AND NOT disabled',[email.toLowerCase()]);
    if (rows[0]) await queueToken(rows[0].id,'reset');
    res.status(202).json({ message:'If an account exists, recovery instructions have been queued.' });
  }));
  router.post('/request-verification', userMiddleware, asyncRoute(async (req,res) => {
    await queueToken(res.locals.user.id,'verify'); res.status(202).json({message:'Verification queued in the local delivery sink.'});
  }));
  router.post('/reset-password', asyncRoute(async (req,res) => {
    const {token,password}=z.object({token:z.string().min(32).max(100),password:credentialsSchema.shape.password}).parse(req.body);
    const hash=await bcrypt.hash(password,12);
    const ids=await transaction(pool,async(client)=>{
      const {rows}=await client.query("UPDATE account_tokens SET used_at=NOW() WHERE token_hash=$1 AND purpose='reset' AND used_at IS NULL AND expires_at>NOW() RETURNING user_id",[digest(token)]);
      if(!rows[0]) throw new HttpError(400,'Invalid or expired recovery token');
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,rows[0].user_id]);
      return (await client.query('UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1 RETURNING id',[rows[0].user_id])).rows;
    });
    ids.forEach(row=>disconnectSession(row.id)); res.json({success:true});
  }));
  router.post('/verify',asyncRoute(async(req,res)=>{
    const {token}=z.object({token:z.string().min(32).max(100)}).parse(req.body);
    await transaction(pool,async(client)=>{
      const {rows}=await client.query("UPDATE account_tokens SET used_at=NOW() WHERE token_hash=$1 AND purpose='verify' AND used_at IS NULL AND expires_at>NOW() RETURNING user_id",[digest(token)]);
      if(!rows[0]) throw new HttpError(400,'Invalid or expired verification token');
      await client.query('UPDATE users SET email_verified=TRUE WHERE id=$1',[rows[0].user_id]);
    });res.json({success:true});
  }));
  return { authenticate, userMiddleware, deviceMiddleware, router };
}
