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

// Kullanici adi VEYA e-posta ile giris. E-posta gibi görünüyorsa
// dogrudan mevcut GoTrue akisi kullanilir (davranis degismedi). Aksi
// halde, e-postayi asla istemciye/tarayici konsoluna sizdirmadan cozmek
// icin sifreyi de dogrulayan guvenli bir RPC'ye (public.login_resolve_email,
// bkz. 008_login_resolve_email migration) basvurulur - bu RPC, dogru
// sifreyi bilmeyen biri icin e-postayi asla acmaz, o yuzden acik bir
// "kullanici adi -> e-posta" arama motoru degildir.
export async function supabaseSignInWithIdentifier(identifier, password) {
  const trimmed = (identifier || "").trim();
  if (EMAIL_SHAPE_RE.test(trimmed)) {
    return supabaseSignIn(trimmed, password);
  }
  const resolvedEmail = await supabaseRpc("login_resolve_email", SUPABASE_KEY, {
    p_identifier: trimmed,
    p_password: password,
  }).catch(() => null);
  if (!resolvedEmail) {
    throw new Error("Kullanıcı adı/e-posta veya şifre hatalı, ya da hesap henüz doğrulanmadı.");
  }
  return supabaseSignIn(resolvedEmail, password);
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
