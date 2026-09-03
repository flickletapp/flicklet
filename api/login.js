// Kullanici adiyla giris icin SUNUCU TARAFI katman (Vercel Serverless).
//
// Tasarim ilkeleri:
// - Duz sifre ASLA bir veritabani RPC'sine gitmez. Sifre dogrulamasinin
//   TEK yeri Supabase Auth'un kendi /auth/v1/token ucudur; boylece
//   Auth'un hiz sinirlama ve kotuye kullanim korumalari tum sifre
//   denemelerini kapsar.
// - auth.users.encrypted_password okunmaz, hash elle karsilastirilmaz.
// - Kullanici adi -> hesap eslemesi yalnizca burada, service-role
//   anahtariyla yapilir. Bu anahtar sadece sunucu ortaminda bulunur
//   (VITE_ onekli DEGIL, bu yuzden istemci paketine girmez).
// - Istemciye e-posta ayrica dondurulmez; yalnizca Supabase Auth'un
//   normal giris yanitinin aynisi (oturum) iletilir.
// - Sifre, token, e-posta ve anahtarlar HICBIR loga yazilmaz.
// - Tum basarisiz durumlar ayni genel 401 yanitini doner; kullanici adi
//   var/yok ayrimi disariya sizmaz.

const ALLOWED_ORIGIN_EXACT = new Set([
  "https://flicklet.com",
  "https://www.flicklet.com",
  "https://flicklet.vercel.app",
  // Yerel gelistirme (vite dev sunucusu)
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
// Vercel Preview alan adlari: <deployment>-flicklet.vercel.app
const ALLOWED_ORIGIN_SUFFIX = "-flicklet.vercel.app";

function resolveAllowedOrigin(origin) {
  if (!origin) return null;
  if (ALLOWED_ORIGIN_EXACT.has(origin)) return origin;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return null;
    if (hostname.endsWith(ALLOWED_ORIGIN_SUFFIX)) return origin;
  } catch (e) {
    return null;
  }
  return null;
}

function applyCors(req, res) {
  const allowed = resolveAllowedOrigin(req.headers.origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return allowed;
}

// --- Hiz siniri -----------------------------------------------------
// Not: Serverless ortamda bellek ornek (instance) basinadir, bu yuzden
// bu katman "en iyi caba" seviyesindedir - kaba kuvvet denemelerini
// yavaslatir ama tek basina kesin garanti degildir. Asil koruma,
// sifre denemelerinin tamaminin Supabase Auth'un kendi korumali
// ucundan gecmesidir. Daha siki garanti gerekirse paylasimli bir
// depoya (Upstash/Redis vb.) tasinmalidir.
const WINDOW_MS = 10 * 60 * 1000; // 10 dakika
const MAX_ATTEMPTS = 8;
const attempts = new Map(); // key -> { count, resetAt }

function rateLimit(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { limited: false };
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false };
}

// Bellek sizintisini onlemek icin ara ara suresi dolmus kayitlari temizle
function sweep() {
  const now = Date.now();
  for (const [k, v] of attempts) {
    if (now > v.resetAt) attempts.delete(k);
  }
}

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// "@Kullanici Adi " -> "kullaniciadi" mantigi degil; sadece basindaki
// "@" ve bastaki/sondaki bosluklar temizlenir, kucuk harfe cevrilir.
// (profiles.handle degerleri de "@" ile basliyor, karsilastirmada iki
// taraf da ayni sekilde normalize ediliyor.)
function normalizeHandle(raw) {
  return String(raw || "").trim().replace(/^@+/, "").toLowerCase();
}

const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function genericFail(res) {
  // Tum basarisiz durumlarda ayni yanit - hesap var/yok ayrimi yok.
  return res.status(401).json({ error: "invalid_credentials" });
}

// Bulunamayan kullanici adinda, gercek bir Auth cagrisi yapilmadigi icin
// yanit belirgin sekilde daha hizli donerdi. Zamanlama farkini bulaniklastir.
function jitter() {
  return new Promise((r) => setTimeout(r, 120 + Math.floor(Math.random() * 180)));
}

export default async function handler(req, res) {
  const allowedOrigin = applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(allowedOrigin ? 204 : 403).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  // Tarayicidan gelen istekler icin origin allowlist zorunlu.
  if (req.headers.origin && !allowedOrigin) {
    return res.status(403).json({ error: "forbidden_origin" });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Anahtar yoksa GUVENLI TARAFA DUS: kullanici adiyla giris kapali.
  // (Istemci bu durumda kullaniciyi e-posta ile girise yonlendirir.)
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "username_login_unavailable" });
  }

  const { identifier, password } = req.body || {};
  if (!identifier || !password || typeof identifier !== "string" || typeof password !== "string") {
    return genericFail(res);
  }

  // E-posta girildiyse burasi hic kullanilmamali - istemci dogrudan
  // Supabase Auth'a gider. Yine de gelirse ayni genel yanit.
  if (EMAIL_SHAPE_RE.test(identifier.trim())) {
    return genericFail(res);
  }

  const handle = normalizeHandle(identifier);
  if (!handle) return genericFail(res);

  if (Math.random() < 0.02) sweep();
  const limit = rateLimit(`${clientIp(req)}|${handle}`);
  if (limit.limited) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({ error: "too_many_attempts" });
  }

  try {
    // 1) Kullanici adindan hesap id'si (service-role, RLS'i asar ama
    //    sonuc istemciye HIC donmez - sadece burada kullanilir).
    const pattern = encodeURIComponent(`@${handle}`);
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&handle=ilike.${pattern}&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!profileRes.ok) {
      await jitter();
      return genericFail(res);
    }
    const profiles = await profileRes.json();
    const userId = Array.isArray(profiles) && profiles[0] ? profiles[0].id : null;
    if (!userId) {
      await jitter();
      return genericFail(res);
    }

    // 2) Hesabin e-postasi - GoTrue Admin API (sunucu tarafi).
    //    encrypted_password OKUNMAZ; sadece e-posta alinir.
    const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    if (!adminRes.ok) {
      await jitter();
      return genericFail(res);
    }
    const adminUser = await adminRes.json();
    const email = adminUser?.email;
    if (!email) {
      await jitter();
      return genericFail(res);
    }

    // 3) SIFRE DOGRULAMASI: yalnizca Supabase Auth. Anon anahtarla
    //    cagriliyor, yani Auth'un hiz sinirlari ve korumalari gecerli.
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    if (tokenRes.status === 429) {
      const retryAfter = tokenRes.headers.get("retry-after");
      if (retryAfter) res.setHeader("Retry-After", retryAfter);
      return res.status(429).json({ error: "too_many_attempts" });
    }
    if (!tokenRes.ok) {
      return genericFail(res);
    }

    // 4) Basarili: Supabase Auth'un normal giris yanitinin AYNISI
    //    donuluyor (e-posta ayrica/ozel olarak eklenmiyor - bu yanit,
    //    e-postayla giris yapildiginda da alinan yanitin ta kendisi).
    const session = await tokenRes.json();
    return res.status(200).json(session);
  } catch (e) {
    // Hata detayi loglanmaz (icinde kimlik bilgisi olabilir).
    return genericFail(res);
  }
}
