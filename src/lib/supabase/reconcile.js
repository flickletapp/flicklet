// Bagimsiz, saf mantik modulu - KASITLI olarak client.js'i (veya
// import.meta.env kullanan baska hicbir seyi) import ETMIYOR, boylece
// hem uygulama hem de dogrudan Node/ESM testleri (bkz. test dosyalari)
// AYNI GERCEK fonksiyonu, mock'lanan sadece agi (selectFn) vererek
// calistirabiliyor - karar agacinin ayri bir kopyasi tutulmuyor.

// fetch() KENDISI hata firlatirsa (baglanti hic kurulamadi) ya da HTTP
// durumu 5xx ise sunucunun istegi COMMIT edip etmedigi BELIRSIZDIR.
// 4xx ise sunucu istegi TAM degerlendirip once hicbir sey commit
// ETMEDEN reddetmis demektir - KESIN.
export function isAmbiguousError(err) {
  if (!err) return false;
  if (err.networkError) return true;
  if (typeof err.status !== "number") return true; // bilinmeyen sekil - guvenli tarafta kal
  return err.status >= 500;
}

// Bir postId INSERT'i (a) ag/5xx hatasiyla BELIRSIZ kaldiginda YA DA
// (b) ayni postId'ye tekrar denemede unique_violation (23505/409)
// aldiginda - HER IKI durumda da "ilk deneme aslinda basarili olmus
// olabilir" ihtimali var. Bu fonksiyon KOR KOR "4xx = kesin basarisiz"
// DEMEDEN, mevcut kaydin GERCEKTEN bu kullaniciya ve beklenen gorsele
// ait oldugunu dogrular:
//   - dogrulama sorgusu basarisiz olursa veya satir bulunamazsa ->
//     "ambiguous" (KESIN basarisizlik KANITI DEGIL, dosyaya dokunma);
//   - satir bulunur ama sahiplik/gorsel eslesmezse -> "conflict"
//     (GERCEK bir celiski - yine de dosyaya dokunma, kullaniciya acikca
//     bildir, farkli bir attemptId ile tekrar denemesi gerekir);
//   - satir bulunur ve TAM eslesirse -> "recovered" (ilk deneme
//     GERCEKTEN basarili olmus, ayni kayitla devam edilebilir).
export async function reconcilePostInsert({ postId, userId, uploadedPath, accessToken, selectFn }) {
  let existing;
  try {
    existing = await selectFn(
      "posts",
      accessToken,
      `select=id,author_id,image_url&id=eq.${postId}&limit=1`
    );
  } catch (verifyErr) {
    return { status: "ambiguous" };
  }
  if (!Array.isArray(existing) || existing.length === 0) {
    return { status: "ambiguous" };
  }
  const row = existing[0];
  if (row.author_id !== userId) {
    return { status: "conflict", row };
  }
  if (uploadedPath && row.image_url !== uploadedPath) {
    return { status: "conflict", row };
  }
  return { status: "recovered", row };
}

// Bir insert hatasinin "ilk deneme aslinda basarili olmus olabilir"
// izlenimi tasiyip tasimadigini belirler: ya BELIRSIZ (ag/5xx) ya da
// AYNI postId icin unique_violation (409/23505 - baska hicbir sekilde
// olusamaz, cunku id istemci tarafinda uretilen essiz bir UUID).
export function looksLikePriorAttemptMayHaveSucceeded(err) {
  if (isAmbiguousError(err)) return true;
  if (err && (err.code === "23505" || err.status === 409)) return true;
  return false;
}

// Secili petleri post_pets'e baglar - onceki (belirsiz sonuclu) bir
// denemeden kalan baglantilar varsa unique_violation'i (23505) KOR KOR
// basari saymaz, o (post_id, pet_id) ciftinin GERCEKTEN var oldugunu
// ayri bir sorguyla dogrular. CreatePost.jsx'in KULLANDIGI GERCEK
// fonksiyon budur.
export async function ensurePostPetsLinked({ postId, petIds, accessToken, insertFn, selectFn }) {
  for (const petId of petIds) {
    try {
      await insertFn("post_pets", accessToken, { post_id: postId, pet_id: petId });
    } catch (err) {
      if (err.code !== "23505") throw err;
      let linkExists;
      try {
        linkExists = await selectFn(
          "post_pets",
          accessToken,
          `select=post_id&post_id=eq.${postId}&pet_id=eq.${petId}&limit=1`
        );
      } catch (verifyErr) {
        linkExists = [];
      }
      if (!Array.isArray(linkExists) || linkExists.length === 0) throw err;
    }
  }
}
