const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');
let admin = null;
try {
  admin = require('firebase-admin');
} catch (_) {}

function loadEnv(file = path.join(__dirname, '.env')) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] ??= v.replace(/\\n/g, '\n');
    }
  } catch (_) {}
}
loadEnv();

const CFG = {
  port: Number(process.env.PORT || 4300),
  dbUrl: process.env.FIREBASE_DATABASE_URL || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '',
    redirectUri: process.env.GMAIL_REDIRECT_URI || '',
    sender: process.env.GMAIL_SENDER_EMAIL || ''
  },
  admin: {
    email: 'mjdeveloperodisha@gmail.com',
    name: process.env.ADMIN_NAME || 'Administrator'
  },
};

let db = null;
let useMemDb = false;

if (admin && CFG.dbUrl && CFG.projectId && CFG.clientEmail && CFG.privateKey) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: CFG.projectId,
        clientEmail: CFG.clientEmail,
        privateKey: CFG.privateKey
      }),
      databaseURL: CFG.dbUrl
    });
    db = admin.database();
    console.log('[System] Storage connected successfully.');
  } catch (err) {
    console.warn('[System] Cloud storage connection fallback:', err.message);
    useMemDb = true;
  }
} else {
  console.warn('[System] Running with in-memory demo storage. Data will be lost when the process restarts.');
  useMemDb = true;
}

// Never silently run with volatile storage in production. A Firebase outage or
// configuration error must fail closed instead of risking data loss or split state.
if (process.env.NODE_ENV === 'production' && (!db || useMemDb)) {
  throw new Error('Firebase Realtime Database is required in production. Refusing to start with in-memory storage.');
}

// In-memory data store for standalone/mock mode
const memStore = {};

function memGet(p) {
  const parts = p.split('/').filter(Boolean);
  let cur = memStore;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[part];
  }
  return cur !== undefined ? JSON.parse(JSON.stringify(cur)) : null;
}

function memSet(p, v) {
  const parts = p.split('/').filter(Boolean);
  let cur = memStore;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = v !== undefined ? JSON.parse(JSON.stringify(v)) : null;
}

function memUpdate(p, v) {
  const parts = p.split('/').filter(Boolean);
  let cur = memStore;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  const last = parts[parts.length - 1];
  if (cur[last] && typeof cur[last] === 'object' && typeof v === 'object') {
    Object.assign(cur[last], JSON.parse(JSON.stringify(v)));
  } else {
    cur[last] = v !== undefined ? JSON.parse(JSON.stringify(v)) : null;
  }
}

function memRemove(p) {
  const parts = p.split('/').filter(Boolean);
  let cur = memStore;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object') return;
    cur = cur[parts[i]];
  }
  if (cur && parts.length > 0) delete cur[parts[parts.length - 1]];
}

async function get(pathName) {
  if (useMemDb || !db) return memGet(pathName);
  try {
    const snap = await db.ref(pathName).once('value');
    return snap.val();
  } catch (err) {
    console.error('[DB Error] Read failed for ' + pathName + ':', err.message);
    throw Object.assign(new Error('Data storage is temporarily unavailable. Please try again.'), { status:503 });
  }
}

async function set(pathName, value) {
  if (!useMemDb && db) {
    try { await db.ref(pathName).set(value); }
    catch (err) {
      console.error('[DB Error] Save failed for ' + pathName + ':', err.message);
      throw Object.assign(new Error('Data storage is temporarily unavailable. No changes were saved.'), { status:503 });
    }
    return;
  }
  memSet(pathName, value);
}

async function update(pathName, value) {
  if (!useMemDb && db) {
    try { await db.ref(pathName).update(value); }
    catch (err) {
      console.error('[DB Error] Update failed for ' + pathName + ':', err.message);
      throw Object.assign(new Error('Data storage is temporarily unavailable. No changes were saved.'), { status:503 });
    }
    return;
  }
  memUpdate(pathName, value);
}

async function multiUpdate(values){
  if(!values||typeof values!=='object')return;
  if(!useMemDb&&db){try{await db.ref().update(values);}catch(err){console.error('[DB Error] Multi-update failed:',err.message);throw Object.assign(new Error('Data storage is temporarily unavailable. No changes were saved.'),{status:503});}return;}
  for(const [p,v] of Object.entries(values)){if(v===null)memRemove(p);else memSet(p,v);}
}
async function remove(pathName) {
  if (!useMemDb && db) {
    try { await db.ref(pathName).remove(); }
    catch (err) {
      console.error('[DB Error] Delete failed for ' + pathName + ':', err.message);
      throw Object.assign(new Error('Data storage is temporarily unavailable. No changes were saved.'), { status:503 });
    }
    return;
  }
  memRemove(pathName);
}

const DEFAULT_MODULES = [
  { name:'SSC', icon:'🏛️', description:'CGL • CHSL • MTS • GD' },
  { name:'Banking', icon:'🏦', description:'IBPS • SBI • RBI' },
  { name:'Railway', icon:'🚆', description:'RRB NTPC • Group D' },
  { name:'CTET / OTET', icon:'🎓', description:'TET preparation' },
  { name:'Odisha Exams', icon:'🌐', description:'OSSC • OSSSC • OPSC • Police • Other exams' },
  { name:'Defence', icon:'🪖', description:'General preparation' }
];
const nowIso = () => new Date().toISOString();
const uid = (prefix='') => prefix + Date.now().toString(36) + '-' + crypto.randomBytes(5).toString('hex');
function encodeFirebaseKey(value){
  return encodeURIComponent(String(value||'')).replace(/\./g,'%2E');
}
function encodeTimeBySubject(value){
  const out={};
  if(!value||typeof value!=='object'||Array.isArray(value))return out;
  for(const [key,val] of Object.entries(value)){
    const subject=String(key||'General').trim()||'General';
    out[encodeFirebaseKey(subject)]=Number(val)||0;
  }
  return out;
}
const cleanEmail = v => String(v || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9+\-\s]{7,15}$/;
function hashPassword(value) {
  const password=String(value||''), salt=crypto.randomBytes(16).toString('hex');
  return 'scrypt$'+salt+'$'+crypto.scryptSync(password,salt,64).toString('hex');
}
function passwordMatches(value,user) {
  const password=String(value||'');
  if(user?.passwordHash){
    const [scheme,salt,stored]=String(user.passwordHash).split('$');
    if(scheme!=='scrypt'||!salt||!stored||!/^[a-f0-9]{128}$/i.test(stored))return false;
    const expected=Buffer.from(stored,'hex'),actual=crypto.scryptSync(password,salt,expected.length);
    return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
  }
  if(typeof user?.password==='string'){
    const expected=Buffer.from(user.password),actual=Buffer.from(password);
    return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
  }
  return false;
}
function ownsTest(user,test) {
  return !!test && (test.createdById ? test.createdById===user.uid : cleanEmail(test.createdBy)===cleanEmail(user.email));
}
const AUTH_SESSION_SECRET=process.env.AUTH_SESSION_SECRET||(process.env.NODE_ENV==='production'?'':crypto.randomBytes(32).toString('hex'));
const ADMIN_OTP_SECRET=process.env.ADMIN_OTP_SECRET||AUTH_SESSION_SECRET;
if(process.env.NODE_ENV==='production'&&AUTH_SESSION_SECRET.length<32)throw new Error('AUTH_SESSION_SECRET must be configured with at least 32 characters in production.');
const ADMIN_OTP_TTL_MS=10*60*1000;
const SECURITY_ROOT='cem2/security';
const SECURITY_OTP_PATH=SECURITY_ROOT+'/adminOtp';
const SECURITY_SESSION_PATH=SECURITY_ROOT+'/sessions';
const SECURITY_RATE_PATH=SECURITY_ROOT+'/rateLimits';
const rateBuckets=new Map();
const adminOtpState=null;
function clientIp(req){return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim().slice(0,80);}
function rateKeyPart(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex').slice(0,40);}
function securityPathKey(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex');}
function localRateLimit(req,key,limit,windowMs,identity=''){const k=key+':'+clientIp(req)+':'+rateKeyPart(identity),now=Date.now(),b=rateBuckets.get(k);if(!b||now-b.start>=windowMs){rateBuckets.set(k,{start:now,count:1});return;}b.count++;if(b.count>limit)throw Object.assign(new Error('Too many requests. Please wait and try again.'),{status:429});}
async function rateLimit(req,key,limit,windowMs,identity=''){
  if(!db||useMemDb){localRateLimit(req,key,limit,windowMs,identity);return;}
  const now=Date.now(),bucketId=securityPathKey(key+'|'+clientIp(req)+'|'+identity),ref=db.ref(SECURITY_RATE_PATH+'/'+bucketId);
  const tx=await ref.transaction(cur=>{
    const b=cur&&typeof cur==='object'?cur:null;
    if(!b||!Number.isFinite(Number(b.windowStart))||now-Number(b.windowStart)>=windowMs)
      return {windowStart:now,count:1,expiresAt:now+windowMs};
    if(Number(b.blockedUntil)>now)
      return {...b,lastRejectedAt:now};
    const count=Number(b.count)||0;
    if(count>=limit)
      return {...b,blockedUntil:Number(b.blockedUntil)||now+windowMs,lastRejectedAt:now};
    return {...b,count:count+1};
  },undefined,false);
  const b=tx.snapshot.val()||{};
  if(Number(b.blockedUntil)>now)throw Object.assign(new Error('Too many requests. Please wait and try again.'),{status:429});
}
setInterval(()=>{const cutoff=Date.now()-3600000;for(const [k,v] of rateBuckets)if(v.start<cutoff)rateBuckets.delete(k);},900000).unref();
function hashAdminOtp(otp){return crypto.createHmac('sha256',ADMIN_OTP_SECRET).update(String(otp)).digest('hex');}
function hashSessionToken(token){return crypto.createHash('sha256').update(String(token||'')).digest('hex');}
function sessionCookieToken(){return crypto.randomBytes(32).toString('base64url');}
async function createServerSession(record){
  if(!db||useMemDb){
    if(process.env.NODE_ENV==='production')throw Object.assign(new Error('Secure session storage is unavailable.'),{status:503});
    const token=sessionCookieToken(),hash=hashSessionToken(token);await set(SECURITY_SESSION_PATH+'/'+hash,{...record,tokenFallback:token});return token;
  }
  const token=sessionCookieToken(),hash=hashSessionToken(token);
  await set(SECURITY_SESSION_PATH+'/'+hash,{...record,tokenHash:hash});
  return token;
}
async function verifyServerSession(token){
  const raw=String(token||'');if(!/^[A-Za-z0-9_-]{40,100}$/.test(raw))return null;
  const hash=hashSessionToken(raw),s=await get(SECURITY_SESSION_PATH+'/'+hash);
  if(!s||s.tokenFallback&&s.tokenFallback!==raw)return null;
  if(Number(s.expiresAt)<=Date.now()||s.revokedAt)return null;
  return {...s,sessionHash:hash};
}
async function revokeServerSession(token){
  const raw=String(token||'');if(!/^[A-Za-z0-9_-]{40,100}$/.test(raw))return;
  const hash=hashSessionToken(raw);
  if(!db||useMemDb){const s=await get(SECURITY_SESSION_PATH+'/'+hash);if(s)await update(SECURITY_SESSION_PATH+'/'+hash,{revokedAt:nowIso()});return;}
  await update(SECURITY_SESSION_PATH+'/'+hash,{revokedAt:nowIso()});
}
async function createAdminSession(uidValue){return createServerSession({uid:uidValue,email:CFG.admin.email,role:'admin',createdAt:nowIso(),expiresAt:Date.now()+12*60*60*1000});}
async function verifyAdminSession(token){const s=await verifyServerSession(token);return s&&s.role==='admin'&&s.email===CFG.admin.email?s:null;}
async function createUserSession(uidValue,emailValue,roleValue,nameValue,instituteId='',authVersion=1){return createServerSession({uid:uidValue,email:emailValue,role:roleValue,name:nameValue||'User',instituteId:String(instituteId||''),authVersion:Number(authVersion)||1,createdAt:nowIso(),expiresAt:Date.now()+12*60*60*1000});}
async function verifyUserSession(token){const s=await verifyServerSession(token);return s&&['institute','student','teacher'].includes(s.role)?s:null;}
async function issueAdminOtp({email,hash,expiresAt,requestTimestamp}){
  if(!db||useMemDb){
    if(process.env.NODE_ENV==='production')throw Object.assign(new Error('Secure OTP storage is unavailable.'),{status:503});
    return false;
  }
  const ref=db.ref(SECURITY_OTP_PATH);
  const now=Number(requestTimestamp)||Date.now(),state={email,hash,expiry:Number(expiresAt),attempts:0,consumed:false,requestTimestamp:now,createdAt:new Date(now).toISOString(),consumedAt:null};
  const tx=await ref.transaction(cur=>{
    const current=cur&&typeof cur==='object'?cur:null;
    if(current&&now-Number(current.requestTimestamp||0)<60000)return current;
    return state;
  },undefined,false);
  const saved=tx.snapshot.val()||{};
  if(saved.requestTimestamp!==now||saved.hash!==hash)throw Object.assign(new Error('Please wait 60 seconds before requesting another OTP.'),{status:429});
  return true;
}
async function createPasswordResetChallenge(uidValue,hash,expiresAt,requestTimestamp){
  const p=SECURITY_ROOT+'/passwordResets/'+securityPathKey(uidValue);
  await set(p,{uid:String(uidValue),hash:String(hash),expiry:Number(expiresAt),attempts:0,consumed:false,requestTimestamp:Number(requestTimestamp)||Date.now(),createdAt:nowIso(),consumedAt:null});
  return p;
}
async function invalidatePasswordResetChallenge(uidValue){
  const p=SECURITY_ROOT+'/passwordResets/'+securityPathKey(uidValue);
  await set(p,{uid:String(uidValue),hash:'',expiry:0,attempts:0,consumed:true,requestTimestamp:Date.now(),createdAt:nowIso(),consumedAt:nowIso(),invalidated:true});
}
async function consumePasswordResetChallenge(uidValue,otp){
  const p=SECURITY_ROOT+'/passwordResets/'+securityPathKey(uidValue),now=Date.now(),attemptHash=crypto.createHmac('sha256',AUTH_SESSION_SECRET).update(String(otp)).digest('hex'),verificationId=crypto.randomBytes(16).toString('hex');
  if(!db||useMemDb){
    if(process.env.NODE_ENV==='production')throw Object.assign(new Error('Secure password reset storage is unavailable.'),{status:503});
    return {ok:false,reason:'unavailable'};
  }
  const tx=await db.ref(p).transaction(cur=>{
    const current=cur&&typeof cur==='object'?{...cur}:null;
    if(!current||current.consumed||!current.hash||Number(current.expiry)<=now||Number(current.attempts||0)>=5)return current;
    const attempts=Number(current.attempts||0)+1;
    if(attemptHash===String(current.hash))return {...current,attempts,consumed:true,verificationId,consumedAt:new Date(now).toISOString()};
    return {...current,attempts,consumed:attempts>=5,verificationId:null,consumedAt:attempts>=5?new Date(now).toISOString():current.consumedAt||null};
  },undefined,false);
  const saved=tx.snapshot.val()||{};
  if(saved.verificationId===verificationId&&saved.consumed===true)return {ok:true};
  if(!saved.hash||saved.consumed||Number(saved.expiry)<=now||Number(saved.attempts||0)>=5)return {ok:false,reason:'locked'};
  return {ok:false,reason:'incorrect',attempts:Number(saved.attempts||0)};
}
async function invalidateAdminOtp(){
  if(!db||useMemDb){
    if(process.env.NODE_ENV==='production')throw Object.assign(new Error('Secure OTP storage is unavailable.'),{status:503});
    return;
  }
  await set(SECURITY_OTP_PATH,{hash:'',expiry:0,attempts:0,consumed:true,requestTimestamp:Date.now(),createdAt:nowIso(),consumedAt:nowIso(),invalidated:true});
}
async function consumeAdminOtp(otp){
  const now=Date.now(),attemptHash=hashAdminOtp(otp),verificationId=crypto.randomBytes(16).toString('hex');
  if(!db||useMemDb){
    if(process.env.NODE_ENV==='production')throw Object.assign(new Error('Secure OTP storage is unavailable.'),{status:503});
    return {ok:false,reason:'unavailable'};
  }
  const ref=db.ref(SECURITY_OTP_PATH);
  const tx=await ref.transaction(cur=>{
    const current=cur&&typeof cur==='object'?{...cur}:null;
    if(!current||current.consumed||!current.hash||Number(current.expiry)<=now||Number(current.attempts||0)>=5)return current;
    const attempts=Number(current.attempts||0)+1;
    if(attemptHash===String(current.hash))return {...current,attempts,consumed:true,verificationId,consumedAt:new Date(now).toISOString()};
    return {...current,attempts,consumed:attempts>=5,verificationId:null,consumedAt:attempts>=5?new Date(now).toISOString():current.consumedAt||null};
  },undefined,false);
  const saved=tx.snapshot.val()||{};
  if(saved.verificationId===verificationId&&saved.consumed===true)return {ok:true};
  if(!saved.hash||saved.consumed||Number(saved.expiry)<=now||Number(saved.attempts||0)>=5)return {ok:false,reason:'locked'};
  return {ok:false,reason:'incorrect',attempts:Number(saved.attempts||0)};
}
function publicUser(u){if(!u)return null;const x={...u};delete x.password;delete x.passwordHash;delete x.resetToken;delete x.resetTokenExpiry;return x;}
function parseCookies(req){const o={};for(const part of String(req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)o[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}return o;}
async function sendEmail(to, subject, html, text='') {
  if (!CFG.gmail.clientId || !CFG.gmail.clientSecret || !CFG.gmail.refreshToken || !CFG.gmail.sender || !to) {
    console.warn('[Email] Gmail API not fully configured — email skipped for:', to, subject);
    return false;
  }
  try {
    const oauth2 = new google.auth.OAuth2(CFG.gmail.clientId, CFG.gmail.clientSecret, CFG.gmail.redirectUri || undefined);
    oauth2.setCredentials({ refresh_token: CFG.gmail.refreshToken });
    const gmail = google.gmail({ version:'v1', auth:oauth2 });
    const mime = [
      'From: '+CFG.gmail.sender,
      'To: '+to,
      'Subject: '+subject,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html
    ].join('\r\n');
    const raw = Buffer.from(mime).toString('base64url');
    await gmail.users.messages.send({ userId:'me', requestBody:{ raw } });
    return true;
  } catch (e) {
    console.error('Gmail send failed:', e.message);
    return false;
  }
}

const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
const emailShell = (title, body) => '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h2>'+escapeHtml(title)+'</h2>'+body+'<hr><p style="color:#64748b;font-size:12px">Competitive Exam Master</p></div>';

function summarizeTest(t) {
  return {
    id:t.id,title:t.title,exam:t.exam,category:t.category,subjects:t.subjects||['General'],
    languages:t.languages?.length?t.languages:['English'],type:t.type,attemptPolicy:t.attemptPolicy==='once'?'once':'reattempt',
    price:t.price||0,duration:t.duration,questionCount:t.questionCount,createdAt:t.createdAt,published:t.published
  };
}

async function body(req) {
  return new Promise((resolve,reject)=>{
    const chunks=[]; let size=0;
    req.on('data', c=>{ size+=c.length; if(size>5e6){ reject(new Error('Request too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end',()=>{ try{ resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')); }catch(e){ reject(new Error('Invalid JSON body.')); }});
    req.on('error',reject);
  });
}

function isHttps(req){return process.env.NODE_ENV==='production'||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';}
function cookieBase(res){return 'Path=/; HttpOnly; '+(isHttps(res.req)?'Secure; ':'')+'SameSite=Strict; Max-Age=43200';}
function setSessionCookie(res,token,portal){const name=portal==='admin'?'cem_admin_session':portal==='institute'?'cem_institute_session':'cem_user_session';res.setHeader('Set-Cookie',name+'='+encodeURIComponent(token)+'; '+cookieBase(res));}
function clearSessionCookie(res,portal){const base='Path=/; HttpOnly; '+(isHttps(res.req)?'Secure; ':'')+'SameSite=Strict; Max-Age=0';const names=portal==='admin'?['cem_admin_session']:portal==='institute'?['cem_institute_session']:portal==='student'?['cem_user_session']:['cem_admin_session','cem_institute_session','cem_user_session'];res.setHeader('Set-Cookie',names.map(n=>n+'=; '+base));}
function csrfCookieBase(req){return 'Path=/; '+(isHttps(req)?'Secure; ':'')+'SameSite=Strict; Max-Age=43200';}
function createCsrfToken(){const random=crypto.randomBytes(32).toString('base64url');const sig=crypto.createHmac('sha256',AUTH_SESSION_SECRET).update('csrf|'+random).digest('base64url');return random+'.'+sig;}
function setCsrfCookie(res,token){res.setHeader('Set-Cookie',(res.getHeader('Set-Cookie')||[]).concat(['cem_csrf='+encodeURIComponent(token)+'; '+csrfCookieBase(res.req)]));}
function validCsrfToken(token){const parts=String(token||'').split('.');if(parts.length!==2||!/^[A-Za-z0-9_-]{32,100}$/.test(parts[0]))return false;const expected=crypto.createHmac('sha256',AUTH_SESSION_SECRET).update('csrf|'+parts[0]).digest('base64url');return parts[1].length===expected.length&&crypto.timingSafeEqual(Buffer.from(parts[1]),Buffer.from(expected));}
function validateCsrf(req){const origin=String(req.headers.origin||'').trim();const referer=String(req.headers.referer||'').trim();const proto=String(req.headers['x-forwarded-proto']|| (isHttps(req)?'https':'http')).split(',')[0].trim();const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();const target=proto+'://'+host;const source=origin|| (referer?(()=>{try{return new URL(referer).origin}catch(_){return ''}})():'');if(source && source!==target)throw Object.assign(new Error('Cross-site request blocked.'),{status:403});if(String(req.headers['sec-fetch-site']||'').toLowerCase()==='cross-site')throw Object.assign(new Error('Cross-site request blocked.'),{status:403});const cookies=parseCookies(req),cookie=decodeURIComponent(String(cookies.cem_csrf||'')),header=String(req.headers['x-csrf-token']||'');if(!cookie||!header||cookie!==header||!validCsrfToken(header))throw Object.assign(new Error('CSRF validation failed. Refresh the page and try again.'),{status:403});}
function securityHeaders(req){const h={'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','X-DNS-Prefetch-Control':'off','X-Permitted-Cross-Domain-Policies':'none','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"};if(isHttps(req))h['Strict-Transport-Security']='max-age=31536000; includeSubDomains';return h;}
function send(res,status,data){const h=securityHeaders(res.req);Object.assign(h,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'null','Access-Control-Allow-Headers':'Content-Type, Authorization, X-CEM-Portal, X-CSRF-Token','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'});res.writeHead(status,h);res.end(JSON.stringify(data));}

function errorStatus(e){ return Number(e.status)||500; }

function mimeFile(filePath) {
  const ext=path.extname(filePath).toLowerCase();
  return ({
    '.html':'text/html; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.svg':'image/svg+xml'
  })[ext]||'application/octet-stream';
}

function serveStatic(req,res) {
  const url=new URL(req.url,'http://localhost');
  let p;
  if(url.pathname==='/' || url.pathname==='/student') p=path.join(__dirname,'frontend','CompetitiveExamMaster-student.html');
  else if(url.pathname==='/admin') p=path.join(__dirname,'frontend','CompetitiveExamMaster-admin.html');
  else if(url.pathname==='/institute') p=path.join(__dirname,'frontend','CompetitiveExamMaster-institute.html');
  else if(url.pathname.startsWith('/frontend/')) p=path.join(__dirname,url.pathname);
  else return false;
  if(!fs.existsSync(p)) return false;
  const realRoot=path.join(__dirname,'frontend');
  const real=path.resolve(p);
  if(real!==path.resolve(realRoot, path.basename(real)) && !real.startsWith(realRoot+path.sep)) return false;
  res.writeHead(200,{...securityHeaders(req),'Content-Type':mimeFile(p),'Cache-Control':'no-store'});
  fs.createReadStream(p).pipe(res);
  return true;
}

async function ensureSeeds(){
  const root=await get('cem2');
  if(!root||typeof root!=='object'||Array.isArray(root)) await set('cem2',{});
}

const routeV2=require('./v2-router')({
  get,set,remove,multiUpdate,db,useMemDb,crypto,CFG,nowIso,uid,encodeFirebaseKey,cleanEmail,EMAIL_RE,MOBILE_RE,
  hashPassword,passwordMatches,sendEmail,emailShell,rateLimit,validateCsrf,createCsrfToken,setCsrfCookie,
  verifyAdminSession,verifyUserSession,createAdminSession,createUserSession,revokeServerSession,setSessionCookie,clearSessionCookie,
  body,errorStatus,publicUser,send,escapeHtml,adminOtpState,ADMIN_OTP_TTL_MS,hashAdminOtp,update,AUTH_SESSION_SECRET,issueAdminOtp,consumeAdminOtp,invalidateAdminOtp,createPasswordResetChallenge,invalidatePasswordResetChallenge,consumePasswordResetChallenge
});
async function route(req,res){return routeV2(req,res);}

const server=http.createServer(async(req,res)=>{
  server.headersTimeout=65000; server.requestTimeout=120000; server.keepAliveTimeout=5000;
  try {
    if(req.url.startsWith('/api/')) return await route(req,res);
    if(serveStatic(req,res)) return;
    send(res,404,{error:'Not found.'});
  } catch(e) {
    console.error(e);
    send(res,errorStatus(e),{error:e.message||'Server error.'});
  }
});

(async()=>{
  await ensureSeeds();
  server.listen(CFG.port, '0.0.0.0', () => {
    console.log('Competitive Exam Master server running on port ' + CFG.port + ' (0.0.0.0)');
    console.log('Student Portal: http://localhost:' + CFG.port + '/student');
    console.log('Admin Portal:   http://localhost:' + CFG.port + '/admin');
  });
})();
