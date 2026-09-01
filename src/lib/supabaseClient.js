// SDK yerine doğrudan fetch ile REST API kullanılıyor (bilinçli tercih).
export const SUPABASE_URL = "https://kxgjlfdcaelcpceuiczc.supabase.co";
export const SUPABASE_KEY = "sb_publishable_MQZzAS0RloUDP_HCv--rfw__xAHbaM9";

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
