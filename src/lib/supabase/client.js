// SDK yerine doğrudan fetch ile REST API kullanılıyor (bilinçli tercih).
// URL/anahtar ortam değişkeninden geliyor - build zamanında (Vercel'de
// Production/Preview/Development ortamları için ayrı ayrı tanımlanabilir,
// böylece Preview staging'e, Production kendi projesine bağlanabilir).
// Biri eksikse SESSİZCE production'a fallback YAPILMAZ - acik bir
// yapilandirma hatasi firlatilir.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

export async function supabaseSignUp(email, password) {
  return supabaseAuth("signup", { email, password });
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

export async function supabaseInsert(table, accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Kayıt eklenemedi");
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
    throw new Error(data.message || "Fotoğraf yüklenemedi");
  }
  return `${SUPABASE_URL}/storage/v1/object/public/post-images/${path}`;
}
