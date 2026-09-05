// SDK yerine doğrudan fetch ile REST API kullanılıyor (bilinçli tercih).
// URL/anahtar ortam değişkeninden geliyor - build zamanında (Vercel'de
// Production/Preview/Development ortamları için ayrı ayrı tanımlanabilir,
// böylece Preview staging'e, Production kendi projesine bağlanabilir).
// Biri eksikse SESSİZCE production'a fallback YAPILMAZ - acik bir
// yapilandirma hatasi firlatilir.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// reconcile.js import.meta.env'e BAGIMLI DEGIL (kasitli - dogrudan
// Node/ESM testlerinde de calisabilsin diye). Geriye donuk uyumluluk
// icin buradan da disari aciliyor.
export { isAmbiguousError, reconcilePostInsert, looksLikePriorAttemptMayHaveSucceeded } from "./reconcile.js";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Yapılandırma hatası: VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY ortam değişkenleri tanımlı değil. " +
      ".env dosyasını kontrol et (bkz. .env.example)."
  );
}

export async function supabaseAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || "Bir hata oluştu");
  return data;
}

// data verilirse GoTrue'da raw_user_meta_data olarak saklanir -
// handle_new_user() trigger'i (bkz. 013_user_chosen_handle migration)
// kullaniciyi acikca sectigi kullanici adini buradan okur.
export async function supabaseSignUp(email, password, data) {
  return supabaseAuth("signup", data ? { email, password, data } : { email, password });
}

// Kullanici adinin gecerlilik kurallari - istemci tarafi ilk savunma
// katmani. Sunucu tarafinda (handle_new_user trigger) ayni karakter
// filtresi ikinci kez uygulanir; asil benzersizlik garantisi
// profiles_handle_lower_unique index'inden gelir.
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

// "@ridvan", "  ridvan " -> "ridvan". Bastaki "@" ve bosluklar temizlenir.
export function normalizeUsernameInput(raw) {
  return String(raw || "").trim().replace(/^@+/, "");
}

export function validateUsername(raw) {
  const cleaned = normalizeUsernameInput(raw);
  if (!cleaned) return { valid: false, error: "Kullanıcı adı boş olamaz." };
  if (!USERNAME_RE.test(cleaned)) {
    return {
      valid: false,
      error: "Kullanıcı adı yalnızca harf, rakam ve alt çizgi (_) içerebilir, 3-20 karakter olmalı. Örn: ayse_yilmaz93",
    };
  }
  return { valid: true, value: cleaned };
}

// profiles.handle uzerinde dogrudan INSERT/UPDATE'i reddeden DB trigger'inin
// (bkz. 015_profiles_handle_db_guard) SQL MESSAGE kisimlari icin Turkce
// karsilik. Client kontrolu asilip DB'ye ham bir istek giderse, PostgREST'in
// dondurdugu ham kod-kelime ("invalid_username"/"username_taken") kullaniciya
// GOSTERILMEZ - burada ayni Turkce metne cevrilir.
export function mapUsernameDbError(rawMessage) {
  if (rawMessage === "invalid_username") {
    return "Kullanıcı adı yalnızca harf, rakam ve alt çizgi (_) içerebilir, 3-20 karakter olmalı. Örn: ayse_yilmaz93";
  }
  if (rawMessage === "username_taken") {
    return "Bu kullanıcı adı az önce alındı. Lütfen başka bir kullanıcı adı seç.";
  }
  return null;
}

// Hesap olusturulmadan ONCE uygunluk kontrolu - profiles tablosu
// herkese acik okunabilir (RLS: using(true)), oturum gerekmez.
// Case-insensitive karsilastirma (ilike) kullanilir.
export async function checkUsernameAvailable(cleanedUsername) {
  const pattern = encodeURIComponent("@" + cleanedUsername);
  const rows = await supabaseSelect("profiles", null, `select=id&handle=ilike.${pattern}&limit=1`);
  return rows.length === 0;
}

export async function supabaseSignIn(email, password) {
  return supabaseAuth("token?grant_type=password", { email, password });
}

const EMAIL_SHAPE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cagiranin ayirt edebilmesi icin ozel hata tipleri. Mesajlar tek ve
// genel tutulur; hesap var/yok ayrimi yapilmaz.
export const LOGIN_GENERIC_ERROR = "Kullanıcı adı/e-posta veya şifre hatalı.";
export const LOGIN_RATE_LIMITED = "rate_limited";
export const LOGIN_USERNAME_UNAVAILABLE = "username_unavailable";

// Kullanici adi VEYA e-posta ile giris.
//
// - E-posta girildiyse: dogrudan Supabase Auth (signInWithPassword
//   esdegeri) kullanilir - bu yol hic degismedi.
// - Kullanici adi girildiyse: istek, SUNUCU TARAFI /api/login katmanina
//   gider (bkz. api/login.js). Sifre hicbir zaman bir veritabani
//   RPC'sine gonderilmez; dogrulama her zaman Supabase Auth'ta yapilir.
//   Sunucu, kullanici adi -> hesap eslemesini service-role anahtariyla
//   yalnizca kendi tarafinda cozer ve istemciye yalnizca normal Auth
//   oturum yanitini doner (e-posta ayrica dondurulmez).
export async function supabaseSignInWithIdentifier(identifier, password) {
  const trimmed = (identifier || "").trim();
  if (EMAIL_SHAPE_RE.test(trimmed)) {
    return supabaseSignIn(trimmed, password);
  }

  let res;
  try {
    res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: trimmed, password }),
    });
  } catch (e) {
    throw new Error(LOGIN_GENERIC_ERROR);
  }

  if (res.status === 429) {
    const err = new Error(LOGIN_RATE_LIMITED);
    err.code = LOGIN_RATE_LIMITED;
    err.retryAfter = res.headers.get("retry-after");
    throw err;
  }
  if (res.status === 503) {
    const err = new Error(LOGIN_USERNAME_UNAVAILABLE);
    err.code = LOGIN_USERNAME_UNAVAILABLE;
    throw err;
  }
  if (!res.ok) {
    throw new Error(LOGIN_GENERIC_ERROR);
  }

  const session = await res.json().catch(() => null);
  if (!session?.access_token) {
    throw new Error(LOGIN_GENERIC_ERROR);
  }
  return session;
}

export async function supabaseFetchTable(path, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error("Veri alınamadı");
  return res.json();
}

export async function supabaseGetUser(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error("Kullanıcı bilgisi alınamadı");
  return res.json();
}

// isAmbiguousError artik reconcile.js'ten geliyor (yukarida re-export
// edildi) - fetch() KENDISI hata firlatirsa (baglanti hic kurulamadi)
// bu AG SEVIYESINDE bir hatadir: sunucunun istegi commit edip etmedigi
// TAMAMEN belirsizdir. `networkError=true` ile isaretlenir.
export async function supabaseInsert(table, accessToken, body) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${accessToken}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const e = new Error("Ağ hatası: sunucuya ulaşılamadı.");
    e.networkError = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || "Kayıt eklenemedi");
    e.code = data.code;
    e.status = res.status;
    throw e;
  }
  return data;
}

export async function supabaseUpdate(table, accessToken, match, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Kayıt güncellenemedi");
  return data;
}

export async function supabaseSelect(table, accessToken, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Veri alınamadı");
  return data;
}

export async function supabaseCount(table, accessToken, query = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  if (!res.ok) throw new Error("Sayı alınamadı");
  const range = res.headers.get("content-range");
  return range ? parseInt(range.split("/")[1], 10) || 0 : 0;
}

export async function supabaseUpsert(table, accessToken, body, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Kayıt kaydedilemedi");
  return data;
}

export async function supabaseDelete(table, accessToken, match) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Kayıt silinemedi");
  }
}

export async function supabaseRpc(fn, accessToken, params = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "İşlem başarısız oldu");
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

// post-images bucket'i PRIVATE (bkz. 016_post_images_private_access) -
// DB'ye artik TAM URL degil, BARE PATH yaziliyor. Gosterim aninda
// resolveImageUrl() ile imzali URL alinir.
const IMAGE_MIME_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

// Kullanicinin sectigi dosya adi HICBIR ZAMAN yol olarak kullanilmaz -
// sadece MIME turunden turetilen sabit bir uzanti kullanilir.
export function extensionForImageFile(file) {
  return IMAGE_MIME_EXT[file?.type] || "jpg";
}

// Gonderi: <userId>/<attemptId>.<ext>  |  Avatar: avatars/<userId>/<attemptId>.<ext>
// attemptId cagiran tarafta (CreatePost/Profile) OLUSTURULUP tekrar
// denemeler arasinda SABIT tutulmali - boylece ayni yukleme/kayit
// girisimi ayni path'i uretir ve belirsiz sonuc sonrasi guvenle
// dogrulanabilir (bkz. CreatePost.jsx publish()).
export function makeImagePath({ kind, userId, attemptId, file }) {
  const ext = extensionForImageFile(file);
  return kind === "avatar" ? `avatars/${userId}/${attemptId}.${ext}` : `${userId}/${attemptId}.${ext}`;
}

// Bilinen Storage hata metinlerini Turkce'ye cevirir. Taninmayan bir
// hata icin null doner - cagiran genel bir fallback mesaj kullanmali.
export function mapStorageError(rawMessage) {
  const m = (rawMessage || "").toLowerCase();
  if (m.includes("bucket not found")) return "Fotoğraf deposu şu an kullanılamıyor. Lütfen daha sonra tekrar dene.";
  if (m.includes("exceeded the maximum allowed size") || m.includes("payload too large")) {
    return "Fotoğraf çok büyük (en fazla 10MB olabilir). Lütfen daha küçük bir dosya seç.";
  }
  if (m.includes("mime type") && m.includes("not supported")) {
    return "Bu dosya türü desteklenmiyor. Lütfen JPEG, PNG, WebP veya GIF seç.";
  }
  if (m.includes("not found")) return "Fotoğraf bulunamadı.";
  if (m.includes("new row violates row-level security") || m.includes("unauthorized") || m.includes("permission denied")) {
    return "Bu işlem için yetkin yok.";
  }
  return null;
}

// Yeniden deneme sirasinda AYNI path'e ikinci kez yukleme yapilirsa
// Storage "The resource already exists" doner - bu GERCEK bir hata
// DEGIL, ilk denemenin aslinda basarili oldugunun isareti (bkz.
// CreatePost.jsx'teki belirsiz-sonuc kurtarma akisi).
export function isAlreadyExistsError(message) {
  return /already exists|duplicate/i.test(message || "");
}

export async function supabaseUploadImage(path, file, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": file.type,
    },
    body: file,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const raw = data.message || "";
    const e = new Error(mapStorageError(raw) || "Fotoğraf yüklenemedi");
    e.rawMessage = raw;
    throw e;
  }
  return path;
}

export async function supabaseDeleteImage(path, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/post-images/${path}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(mapStorageError(data.message) || "Fotoğraf silinemedi");
  }
}

// ---------------------------------------------------------------------
// Gorsel URL cozumleme - DB'de BARE PATH tutulur, gosterim aninda kisa
// omurlu imzali URL alinir. Onbellek KULLANICI/OTURUM bazlidir; cikista
// veya hesap degisiminde clearImageCache() cagrilmali (bkz. useAuth.js
// handleLogout) - AKSI HALDE onceki hesabin imzali URL'leri yeni oturuma
// sizabilir.
// ---------------------------------------------------------------------
const SIGN_TTL_SECONDS = { post: 300, avatar: 86400 }; // 5 dk / 24 saat
let _imgCacheUserId = undefined;
let _imgCache = new Map(); // path -> { url, expiresAt }
let _imgInflight = new Map(); // path -> Promise<string>

// ResolvedImage bilesenin (ui.jsx) suresi dolmadan ONCEDEN yenileme
// zamanlayabilmesi icin gercek onbellek suresini disari acar.
export function getCachedImageExpiry(path) {
  return _imgCache.get(path)?.expiresAt ?? null;
}

export function clearImageCache() {
  _imgCache = new Map();
  _imgInflight = new Map();
  _imgCacheUserId = undefined;
}

function ensureImageCacheScope(userId) {
  if (_imgCacheUserId !== userId) {
    _imgCache = new Map();
    _imgInflight = new Map();
    _imgCacheUserId = userId;
  }
}

// KENDI bucket'imizin TAM public URL onekiyle basliyorsa (eski, henuz
// migration 016'nin backfill'inden gecmemis bir kayit) bare path'e
// cevrilir. ONEMLI: bu kontrol SADECE gercekten YAPILANDIRILMIS
// SUPABASE_URL + tam bucket yolunu eslestirir - "herhangi bir
// *.supabase.co" gibi genis bir kalip DEGIL. Baska bir Supabase
// projesinin veya dis bir kaynagin URL'si (ornegin OAuth saglayicidan
// gelen bir avatar) burada YANLISLIKLA bu projenin dosya yolu gibi
// yorumlanmaz - oldugu gibi (externalUrl) dondurulur.
const LEGACY_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/post-images/`;

export function normalizeStoredImageValue(value) {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith(LEGACY_PUBLIC_PREFIX)) {
    return { path: value.slice(LEGACY_PUBLIC_PREFIX.length) };
  }
  if (/^https?:\/\//i.test(value)) {
    return { externalUrl: value };
  }
  return { path: value };
}

async function signImagePath(path, accessToken, ttlSeconds) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/post-images/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
    },
    body: JSON.stringify({ expiresIn: ttlSeconds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.signedURL) {
    throw new Error(mapStorageError(data.message) || "Fotoğraf adresi alınamadı");
  }
  // ONEMLI: data.signedURL "/storage/v1"E GORE GORECELI bir yol donuyor
  // (ör. "/object/sign/post-images/..."), SUPABASE_URL KOKUNE GORE DEGIL.
  // Onceki halde "/storage/v1" oneki eksikti - Storage sunucusu bu
  // gecersiz yolu 404 "requested path is invalid" ile reddediyordu (bu
  // durum staging'de gercek bir gonderiyle DOGRULANDI: sign istegi 200
  // donuyordu ama indirme URL'i bu eksik onek yuzunden calismiyordu).
  return `${SUPABASE_URL}/storage/v1${data.signedURL}`;
}

// path: DB'den gelen ham deger (bare path, eski tam URL veya dis URL
// olabilir). kind: "post" | "avatar" - sadece onbellek suresini secer,
// GUVENLIK tamamen sunucu tarafi RLS'ten gelir (bkz. 016 migration).
// ui.jsx'teki ResolvedImage, suresi dolmadan ONCEDEN (proaktif) yenileme
// zamanlar - bu payin BU ONBELLEGIN "hala taze" kabul ettigi esikten
// KUCUK olmasi ZORUNLU, aksi halde proaktif cagri "zaten taze" diye ayni
// (suresi dolmak uzere olan) URL'i geri alir ve her seferinde ayni ana
// yakin yeniden planlama yapar - pratikte sifir-gecikmeli bir donguye
// donusur. Iki deger BURADAN turetilir, birbirinden BAGIMSIZ ikinci bir
// sabit olarak ui.jsx'te TEKRAR TANIMLANMAZ.
export const IMAGE_STALE_MARGIN_MS = 15_000; // onbellegin "taze" kabul esigi
export const IMAGE_PROACTIVE_REFRESH_MARGIN_MS = 10_000; // ui.jsx bu kadar once yeniler (< STALE_MARGIN)

// Ayni path icin AYNI ANDA birden fazla cagri gelirse (ör. ayni gonderi
// birden fazla yerde render ediliyorsa) TEK bir imzalama istegi
// paylasilir (istek birlestirme).
export async function resolveImageUrl(rawValue, kind, accessToken, userId) {
  const normalized = normalizeStoredImageValue(rawValue);
  if (!normalized) return null;
  if (normalized.externalUrl) return normalized.externalUrl;
  const path = normalized.path;

  ensureImageCacheScope(userId ?? null);

  const now = Date.now();
  const cached = _imgCache.get(path);
  if (cached && cached.expiresAt - now > IMAGE_STALE_MARGIN_MS) return cached.url;

  if (_imgInflight.has(path)) return _imgInflight.get(path);

  const ttl = SIGN_TTL_SECONDS[kind] || SIGN_TTL_SECONDS.post;
  const promise = signImagePath(path, accessToken, ttl)
    .then((url) => {
      _imgCache.set(path, { url, expiresAt: Date.now() + ttl * 1000 });
      _imgInflight.delete(path);
      return url;
    })
    .catch((e) => {
      _imgInflight.delete(path);
      throw e;
    });
  _imgInflight.set(path, promise);
  return promise;
}
