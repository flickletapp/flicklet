import React, { useState, useRef, useEffect } from "react";
import { Heart, MessageCircle, Trophy, User, Home, Plus, Lock, Globe, X, Camera, ChevronLeft, Flag, Award, Flame, Search, Mail, Send, Sparkles, Compass } from "lucide-react";

// ---------- Supabase bağlantısı (SDK yerine doğrudan fetch ile REST API) ----------
const SUPABASE_URL = "https://kxgjlfdcaelcpceuiczc.supabase.co";
const SUPABASE_KEY = "sb_publishable_MQZzAS0RloUDP_HCv--rfw__xAHbaM9";

async function supabaseAuth(path, body) {
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

async function supabaseSignUp(email, password) {
  return supabaseAuth("signup", { email, password });
}

async function supabaseSignIn(email, password) {
  return supabaseAuth("token?grant_type=password", { email, password });
}

async function supabaseFetchTable(path, accessToken) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken || SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error("Veri alınamadı");
  return res.json();
}

// ---------- Design tokens ----------
const C = {
  paper: "#FBF3E7",
  ink: "#24211D",
  inkSoft: "#6B645A",
  mustard: "#F4A100",
  mustardDark: "#C97F00",
  pine: "#17594B",
  coral: "#FF6F5C",
  cream: "#FFFFFF",
  line: "#EAE0CF",
};

const FONT_DISPLAY = "'Fredoka', system-ui, sans-serif";
const FONT_BODY = "'Nunito', system-ui, sans-serif";

// ---------- Mock data ----------
const CATEGORIES = ["En Tatlı Bakış", "En Komik An", "En İyi Kostüm", "En Tembel Poz"];

const seedPosts = [
  {
    id: 1,
    human: "Aslı K.",
    pet: "Mustafa",
    petEmoji: "🐱",
    caption: "Sabah kahvemi çalmaya çalışıyor yine 😹",
    likes: 128,
    comments: 14,
    contest: null,
    votes: 0,
    color: "#F4A100",
    tag: "#SabahRutini",
  },
  {
    id: 2,
    human: "Emre T.",
    pet: "Zeytin",
    petEmoji: "🐶",
    caption: "Yeni tasmasıyla poz veriyor, onaylıyor musunuz?",
    likes: 89,
    comments: 6,
    contest: null,
    votes: 0,
    color: "#17594B",
    tag: "#YeniAksesuar",
  },
  {
    id: 3,
    human: "Selin Y.",
    pet: "Pamuk",
    petEmoji: "🐰",
    caption: "Bugün havuç festivali var evde 🥕",
    likes: 64,
    comments: 5,
    contest: null,
    votes: 0,
    color: "#7A5CFF",
    tag: "#BeslenmeSaati",
  },
  {
    id: 4,
    human: "Deniz A.",
    pet: "Boncuk",
    petEmoji: "🐹",
    caption: "Kostüm günü! Bal kabağı mı olsun demiştik",
    likes: 256,
    comments: 31,
    contest: "En İyi Kostüm",
    votes: 501,
    color: "#FF6F5C",
    tag: "#KostümGünü",
  },
  {
    id: 5,
    human: "Barış K.",
    pet: "Şeker",
    petEmoji: "🐕",
    caption: "Parkta koşarken çekildi, tam uçuyor gibi",
    likes: 143,
    comments: 9,
    contest: null,
    votes: 0,
    color: "#17594B",
    tag: "#ParkGünü",
  },
  {
    id: 6,
    human: "Aslı K.",
    pet: "Mustafa",
    petEmoji: "🐱",
    caption: "Öğlen uykusu kutsaldır 😴",
    likes: 201,
    comments: 12,
    contest: "En Tatlı Bakış",
    votes: 342,
    color: "#F4A100",
    tag: "#TembelPoz",
  },
];

const MOCK_USERS = [
  { handle: "@hardensouls", human: "Harden S.", pet: "Kaplan", petEmoji: "🐈‍⬛", color: "#17594B", followers: 412 },
  { handle: "@asli.k", human: "Aslı K.", pet: "Mustafa", petEmoji: "🐱", color: "#F4A100", followers: 128 },
  { handle: "@emret", human: "Emre T.", pet: "Zeytin", petEmoji: "🐶", color: "#17594B", followers: 89 },
  { handle: "@seliny", human: "Selin Y.", pet: "Pamuk", petEmoji: "🐰", color: "#7A5CFF", followers: 64 },
  { handle: "@denizA", human: "Deniz A.", pet: "Boncuk", petEmoji: "🐹", color: "#FF6F5C", followers: 256 },
  { handle: "@bariskk", human: "Barış K.", pet: "Şeker", petEmoji: "🐕", color: "#17594B", followers: 143 },
];

const MOCK_FOLLOWERS = [
  { handle: "@seliny", human: "Selin Y.", petEmoji: "🐰", color: "#7A5CFF" },
  { handle: "@bariskk", human: "Barış K.", petEmoji: "🐕", color: "#17594B" },
  { handle: "@hardensouls", human: "Harden S.", petEmoji: "🐈‍⬛", color: "#17594B" },
];

const TRENDING = [
  { tag: "#TembelPoz", count: "2.4B" },
  { tag: "#KostümGünü", count: "1.8B" },
  { tag: "#ParkGünü", count: "980" },
  { tag: "#SabahRutini", count: "740" },
  { tag: "#BeslenmeSaati", count: "512" },
  { tag: "#YeniAksesuar", count: "310" },
];

const CONVERSATIONS = [
  {
    id: 1,
    handle: "@seliny",
    human: "Selin Y.",
    petEmoji: "🐰",
    color: "#7A5CFF",
    canMessage: true,
    lastMessage: "Pamuk'un fotoğrafı çok tatlıymış 😍",
    unread: true,
    messages: [
      { from: "them", text: "Selam! Pamuk'un fotoğrafı çok tatlıymış 😍" },
      { from: "me", text: "Teşekkürler! Yeni kostümünü deniyordu" },
    ],
  },
  {
    id: 2,
    handle: "@bariskk",
    human: "Barış K.",
    petEmoji: "🐕",
    color: "#17594B",
    canMessage: true,
    lastMessage: "Park önerisi için teşekkürler",
    unread: false,
    messages: [
      { from: "them", text: "Hangi parkı önerirsin, köpek dostu bir yer arıyorum" },
      { from: "me", text: "Belgrad Ormanı harika, geniş alan var" },
      { from: "them", text: "Park önerisi için teşekkürler" },
    ],
  },
];

const CATEGORY_SUGGESTIONS = [
  { id: 1, name: "En İyi Uyku Pozu", votes: 214 },
  { id: 2, name: "En Enerjik An", votes: 187 },
  { id: 3, name: "En Şaşkın Bakış", votes: 156 },
  { id: 4, name: "İkili Dostluk (2 hayvan bir arada)", votes: 98 },
];

const leaderboard = [
  { rank: 1, pet: "Boncuk", human: "Deniz A.", emoji: "🐹", votes: 501 },
  { rank: 2, pet: "Mustafa", human: "Aslı K.", emoji: "🐱", votes: 342 },
  { rank: 3, pet: "Pamuk", human: "Selin Y.", emoji: "🐰", votes: 298 },
];

// ---------- Small building blocks ----------
function PawBadge({ children, color = C.mustard }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px 5px",
        borderRadius: "14px 14px 14px 2px",
        background: color,
        color: C.cream,
        fontFamily: FONT_DISPLAY,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function BlobAvatar({ emoji, size = 48, color = C.mustard }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "42% 58% 55% 45% / 48% 42% 58% 52%",
        background: color + "22",
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
      }}
    >
      {emoji}
    </div>
  );
}

function PrimaryButton({ children, onClick, style, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 500,
        fontSize: 15,
        color: C.cream,
        background: disabled ? "#D8CBA8" : C.mustard,
        border: "none",
        borderRadius: 14,
        padding: "13px 20px",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : `0 4px 0 ${C.mustardDark}`,
        transition: "transform 0.08s ease",
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "translateY(3px)")}
      onMouseUp={(e) => !disabled && (e.currentTarget.style.transform = "translateY(0)")}
    >
      {children}
    </button>
  );
}

function TextField({ label, type = "text", value, onChange, placeholder, icon }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>{label}</span>
      <div style={{ position: "relative", marginTop: 6 }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            border: `2px solid ${C.line}`,
            fontFamily: FONT_BODY,
            fontSize: 15,
            color: C.ink,
            background: C.cream,
            outline: "none",
          }}
        />
      </div>
    </label>
  );
}

// ---------- Screens ----------
function AuthScreen({ onDone, onGuest }) {
  const [mode, setMode] = useState("signup"); // signup | verify | login
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    setError("");
    if (!email || !pw) return setError("E-posta ve şifre gerekli.");
    if (pw.length < 8) return setError("Şifre en az 8 karakter olmalı.");
    setLoading(true);
    try {
      await supabaseSignUp(email, pw);
      setMode("verify");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError("");
    if (!email || !pw) return setError("E-posta ve şifre gerekli.");
    setLoading(true);
    try {
      const data = await supabaseSignIn(email, pw);
      onDone(data);
    } catch (e) {
      setError("E-posta veya şifre hatalı, ya da hesap henüz doğrulanmadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px 24px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 34,
            fontWeight: 600,
            color: C.pine,
            letterSpacing: -0.5,
          }}
        >
          flicklet
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginTop: 4 }}>
          Evcil dostların sosyal evi
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#FDECEA",
            color: "#C0392B",
            padding: "10px 14px",
            borderRadius: 10,
            fontFamily: FONT_BODY,
            fontSize: 12.5,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {(mode === "signup" || mode === "login") && (
        <>
          <div
            style={{
              textAlign: "center",
              marginBottom: 18,
              fontFamily: FONT_BODY,
              fontSize: 12.5,
              color: C.inkSoft,
              background: C.cream,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            🔒 Google ile giriş, uygulama yayına alındığında (gerçek domain bağlanınca) aktif olacak — şimdilik e-posta ile devam edin.
          </div>

          <TextField label="E-posta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@eposta.com" />
          <TextField label="Şifre" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="En az 8 karakter" />
          <PrimaryButton style={{ width: "100%", marginTop: 8 }} disabled={loading} onClick={mode === "signup" ? handleSignUp : handleLogin}>
            {loading ? "..." : mode === "signup" ? "Hesap Oluştur" : "Giriş Yap"}
          </PrimaryButton>
          <div style={{ textAlign: "center", marginTop: 16, fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
            {mode === "signup" ? (
              <>
                Zaten hesabın var mı?{" "}
                <span onClick={() => setMode("login")} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>
                  Giriş yap
                </span>
              </>
            ) : (
              <>
                Hesabın yok mu?{" "}
                <span onClick={() => setMode("signup")} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>
                  Kayıt ol
                </span>
              </>
            )}
          </div>
          <div
            onClick={onGuest}
            style={{
              textAlign: "center",
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.mustardDark,
              cursor: "pointer",
            }}
          >
            Üye olmadan gözat →
          </div>
        </>
      )}

      {mode === "verify" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📩</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: C.ink, marginBottom: 6 }}>E-postanı kontrol et</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginBottom: 24, lineHeight: 1.5 }}>
            <strong>{email}</strong> adresine gerçek bir doğrulama bağlantısı gönderdik. Gelen kutunu (ve spam klasörünü) kontrol edip bağlantıya tıkla, sonra buraya dönüp giriş yap.
          </div>
          <PrimaryButton style={{ width: "100%" }} onClick={() => setMode("login")}>
            Doğruladım, giriş yap
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function ProfileSetupScreen({ onDone }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("cat");

  return (
    <div style={{ padding: "32px 24px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[1, 2].map((s) => (
          <div key={s} style={{ flex: 1, height: 5, borderRadius: 3, background: s <= step ? C.mustard : C.line }} />
        ))}
      </div>

      {step === 1 && (
        <>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.ink, marginBottom: 4 }}>Önce seni tanıyalım</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginBottom: 24 }}>
            Bu senin insan profilin — hayvanlarını birazdan ekleyeceksin.
          </div>
          <TextField label="Adın Soyadın" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ayşe Yılmaz" />
          <PrimaryButton style={{ width: "100%", marginTop: 8 }} disabled={!name} onClick={() => setStep(2)}>
            Devam et
          </PrimaryButton>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.ink, marginBottom: 4 }}>Şimdi dostunu ekle</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginBottom: 24 }}>
            İstersen daha sonra başka hayvan da ekleyebilirsin.
          </div>
          <TextField label="Hayvanının Adı" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Örn. Mustafa" />
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Türü</span>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[
                { key: "cat", label: "Kedi", emoji: "🐱" },
                { key: "dog", label: "Köpek", emoji: "🐶" },
                { key: "other", label: "Diğer", emoji: "🐾" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPetType(t.key)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    borderRadius: 12,
                    border: `2px solid ${petType === t.key ? C.mustard : C.line}`,
                    background: petType === t.key ? "#FDF1D8" : C.cream,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 13,
                    color: C.ink,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 22 }}>{t.emoji}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton style={{ width: "100%" }} disabled={!petName} onClick={onDone}>
            Profili tamamla
          </PrimaryButton>
        </>
      )}
    </div>
  );
}

function CreatePostScreen({ myPets, onPublish, onCancel }) {
  const [selectedPet, setSelectedPet] = useState(myPets[0]?.name || "");
  const [caption, setCaption] = useState("");
  const [contestOn, setContestOn] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [photoTone, setPhotoTone] = useState(C.mustard);

  const tones = [C.mustard, C.pine, C.coral, "#7A5CFF"];

  return (
    <div>
      <TopBar title="Yeni Gönderi" onBack={onCancel} />
      <div style={{ padding: "16px 18px 90px", maxWidth: 480, margin: "0 auto" }}>
        <div
          onClick={() => setPhotoTone(tones[(tones.indexOf(photoTone) + 1) % tones.length])}
          style={{
            height: 220,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${photoTone}33, ${photoTone}11)`,
            border: `2px dashed ${photoTone}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 18,
            cursor: "pointer",
          }}
        >
          <Camera size={30} color={photoTone} />
          <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>Fotoğraf eklemek için dokun</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Hangi dostun?</span>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {myPets.map((p) => (
              <button
                key={p.name}
                onClick={() => setSelectedPet(p.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: `2px solid ${selectedPet === p.name ? C.mustard : C.line}`,
                  background: selectedPet === p.name ? "#FDF1D8" : C.cream,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span>{p.emoji}</span> {p.name}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Açıklama</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Flick at, nasıl olduğunu paylaş 🐾"
            rows={3}
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: 6,
              padding: "12px 14px",
              borderRadius: 12,
              border: `2px solid ${C.line}`,
              fontFamily: FONT_BODY,
              fontSize: 14,
              color: C.ink,
              background: C.cream,
              outline: "none",
              resize: "none",
            }}
          />
        </label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "13px 16px",
            marginBottom: contestOn ? 10 : 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trophy size={18} color={C.mustard} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>Yarışmaya gir</div>
          </div>
          <button
            onClick={() => setContestOn((v) => !v)}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              border: "none",
              background: contestOn ? C.mustard : C.line,
              position: "relative",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: C.cream,
                position: "absolute",
                top: 3,
                left: contestOn ? 21 : 3,
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>

        {contestOn && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "8px 13px",
                    borderRadius: 11,
                    border: `2px solid ${category === c ? C.mustard : C.line}`,
                    background: category === c ? "#FDF1D8" : C.cream,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
              Bu gönderi yarışma süresince, profil ayarından bağımsız olarak herkese açık olacak.
            </div>
          </div>
        )}

        <PrimaryButton
          style={{ width: "100%" }}
          disabled={!caption || !selectedPet}
          onClick={() =>
            onPublish({
              pet: selectedPet,
              petEmoji: myPets.find((p) => p.name === selectedPet)?.emoji || "🐾",
              caption,
              contest: contestOn ? category : null,
              color: photoTone,
            })
          }
        >
          Paylaş
        </PrimaryButton>
      </div>
    </div>
  );
}

function TopBar({ title, onBack, right }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: C.paper + "F2",
        backdropFilter: "blur(6px)",
        borderBottom: `1px solid ${C.line}`,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 32 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.ink }}>
            <ChevronLeft size={22} />
          </button>
        )}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink, fontWeight: 500 }}>{title}</div>
      <div style={{ minWidth: 32, display: "flex", justifyContent: "flex-end" }}>{right}</div>
    </div>
  );
}

function PostCard({ post, onVote, onOpenComplaint, onOpenComments, onOpenProfile, isGuest, onRequireAuth }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [voted, setVoted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);

  if (blocked) {
    return (
      <div
        style={{
          background: C.cream,
          borderRadius: 20,
          border: `1px solid ${C.line}`,
          marginBottom: 16,
          padding: "18px 16px",
          textAlign: "center",
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: C.inkSoft,
        }}
      >
        {post.human} engellendi, gönderileri artık görünmeyecek.
      </div>
    );
  }

  return (
    <div
      style={{
        background: C.cream,
        borderRadius: 20,
        border: `1px solid ${C.line}`,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <div
          onClick={() => !post.isMine && onOpenProfile && onOpenProfile(post)}
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: post.isMine ? "default" : "pointer" }}
        >
          <BlobAvatar emoji={post.petEmoji} color={post.color} />
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{post.pet}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{post.human}</div>
          </div>
        </div>
        {post.contest && <PawBadge color={post.color}>🏆 {post.contest}</PawBadge>}
        {!post.isMine && (
          <button
            onClick={() => {
              if (isGuest) return onRequireAuth();
              setFollowing((v) => !v);
            }}
            style={{
              background: following ? C.cream : C.pine,
              color: following ? C.pine : C.cream,
              border: `1.5px solid ${C.pine}`,
              borderRadius: 10,
              padding: "5px 10px",
              fontFamily: FONT_DISPLAY,
              fontSize: 11.5,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {following ? "Takipte" : "Takip Et"}
          </button>
        )}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 18, padding: "0 4px" }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 26,
                background: C.cream,
                border: `1px solid ${C.line}`,
                borderRadius: 10,
                boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                zIndex: 10,
                minWidth: 150,
              }}
            >
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenComplaint();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: C.coral,
                  textAlign: "left",
                }}
              >
                <Flag size={14} /> Şikayet et
              </button>
              {!post.isMine && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setBlocked(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "10px 12px",
                    background: "none",
                    border: "none",
                    borderTop: `1px solid ${C.line}`,
                    cursor: "pointer",
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    color: C.inkSoft,
                    textAlign: "left",
                  }}
                >
                  <X size={14} /> Engelle
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          height: 240,
          background: `linear-gradient(135deg, ${post.color}33, ${post.color}11)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 72,
        }}
      >
        {post.petEmoji}
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
          <button
            onClick={() => {
              if (isGuest) return onRequireAuth();
              setLiked((v) => !v);
              setLikeCount((c) => (liked ? c - 1 : c + 1));
            }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Heart size={22} color={liked ? C.coral : C.inkSoft} fill={liked ? C.coral : "none"} strokeWidth={2} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.inkSoft }}>{likeCount}</span>
          </button>
          <div
            onClick={() => (isGuest ? onRequireAuth() : onOpenComments())}
            style={{ display: "flex", alignItems: "center", gap: 5, color: C.inkSoft, cursor: "pointer" }}
          >
            <MessageCircle size={20} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>{post.comments}</span>
          </div>

          {post.contest && (
            <button
              onClick={() => {
                if (isGuest) return onRequireAuth();
                if (!voted) {
                  setVoted(true);
                  onVote && onVote(post.id);
                }
              }}
              disabled={voted}
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: voted ? "#EFEAE0" : post.color,
                color: voted ? C.inkSoft : C.cream,
                border: "none",
                borderRadius: 10,
                padding: "7px 12px",
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                cursor: voted ? "default" : "pointer",
              }}
            >
              <Trophy size={14} />
              {voted ? "Oy verildi" : "Oy ver"}
            </button>
          )}
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 800 }}>{post.pet}</span> — {post.caption}
          {post.tag && <span style={{ color: C.pine, fontWeight: 700 }}> {post.tag}</span>}
        </div>
      </div>
    </div>
  );
}

function FeedScreen({ posts, onVote, onOpenComplaint, onOpenProfile, onCompose, onOpenSearch, onOpenInbox, myFirstPet, isGuest, onRequireAuth }) {
  const [commentPost, setCommentPost] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const shown = activeTag ? posts.filter((p) => p.tag === activeTag) : posts;
  const unreadCount = CONVERSATIONS.filter((c) => c.unread).length;

  return (
    <div>
      <TopBar
        title="Flicklet"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => (isGuest ? onRequireAuth() : onOpenSearch())}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, padding: 0, display: "flex" }}
            >
              <Search size={19} />
            </button>
            <button
              onClick={() => (isGuest ? onRequireAuth() : onOpenInbox())}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, padding: 0, display: "flex", position: "relative" }}
            >
              <Mail size={19} />
              {!isGuest && unreadCount > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: C.coral,
                  }}
                />
              )}
            </button>
            {!isGuest && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.pine }}>
                <Flame size={16} />
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12 }}>7</span>
              </div>
            )}
          </div>
        }
      />

      <div style={{ padding: "14px 14px 4px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, color: C.inkSoft, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          🔥 Gündemde
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>
          {TRENDING.map((t) => (
            <button
              key={t.tag}
              onClick={() => setActiveTag((cur) => (cur === t.tag ? null : t.tag))}
              style={{
                whiteSpace: "nowrap",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 1,
                padding: "8px 13px",
                borderRadius: 13,
                border: `2px solid ${activeTag === t.tag ? C.mustard : C.line}`,
                background: activeTag === t.tag ? "#FDF1D8" : C.cream,
                cursor: "pointer",
                minWidth: 96,
              }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, color: C.ink }}>{t.tag}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft }}>{t.count} flick</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 14px", maxWidth: 480, margin: "0 auto" }}>
        <div
          onClick={() => (isGuest ? onRequireAuth() : onCompose())}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 16,
            padding: "10px 12px",
            marginBottom: 6,
            cursor: "pointer",
          }}
        >
          <BlobAvatar emoji={myFirstPet?.emoji || "🐾"} size={36} color={C.mustard} />
          <div
            style={{
              flex: 1,
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              color: C.inkSoft,
              padding: "9px 14px",
              background: C.paper,
              borderRadius: 20,
            }}
          >
            Flick at, nasıl olduğunu paylaş 🐾
          </div>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "40% 60% 60% 40% / 45% 45% 55% 55%",
              background: C.mustard,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Plus size={17} color={C.cream} />
          </div>
        </div>
      </div>

      {isGuest && (
        <div
          onClick={onRequireAuth}
          style={{
            margin: "4px 14px 0",
            maxWidth: 480 - 28,
            marginLeft: "auto",
            marginRight: "auto",
            background: C.mustard,
            color: C.cream,
            borderRadius: 14,
            padding: "11px 14px",
            fontFamily: FONT_BODY,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          👀 Şu an gözatıyorsun — beğenmek, oy vermek ve paylaşmak için üye ol
        </div>
      )}
      <div style={{ padding: "16px 14px 90px", maxWidth: 480, margin: "0 auto" }}>
        {activeTag && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginBottom: 10 }}>
            {activeTag} etiketli {shown.length} flick gösteriliyor · <span onClick={() => setActiveTag(null)} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>temizle</span>
          </div>
        )}
        {shown.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            onVote={onVote}
            onOpenComplaint={isGuest ? onRequireAuth : onOpenComplaint}
            onOpenComments={() => setCommentPost(p)}
            onOpenProfile={onOpenProfile}
            isGuest={isGuest}
            onRequireAuth={onRequireAuth}
          />
        ))}
      </div>
      {commentPost && <CommentsModal post={commentPost} onClose={() => setCommentPost(null)} />}
    </div>
  );
}

const DISCOVER_FILTERS = ["Tümü", "Bugün Popüler", ...CATEGORIES];

function DiscoverScreen({ posts, onOpenProfile, onOpenComplaint, onOpenComments, onVote, isGuest, onRequireAuth }) {
  const [filter, setFilter] = useState("Tümü");
  const [openPost, setOpenPost] = useState(null);

  const scored = posts
    .slice()
    .sort((a, b) => b.likes + b.votes * 2 - (a.likes + a.votes * 2));

  const shown =
    filter === "Tümü"
      ? scored
      : filter === "Bugün Popüler"
      ? scored.slice(0, 4)
      : scored.filter((p) => p.contest === filter);

  if (openPost) {
    return (
      <div>
        <TopBar title={openPost.pet} onBack={() => setOpenPost(null)} />
        <div style={{ padding: "16px 14px 40px", maxWidth: 480, margin: "0 auto" }}>
          <PostCard
            post={openPost}
            onVote={onVote}
            onOpenComplaint={isGuest ? onRequireAuth : onOpenComplaint}
            onOpenComments={() => onOpenComments(openPost)}
            onOpenProfile={onOpenProfile}
            isGuest={isGuest}
            onRequireAuth={onRequireAuth}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Keşfet" />
      <div style={{ padding: "12px 14px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
          {DISCOVER_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                whiteSpace: "nowrap",
                padding: "8px 13px",
                borderRadius: 12,
                border: `2px solid ${filter === f ? C.mustard : C.line}`,
                background: filter === f ? "#FDF1D8" : C.cream,
                fontFamily: FONT_DISPLAY,
                fontSize: 12,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          padding: "0 10px 90px",
          maxWidth: 480,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
        }}
      >
        {shown.map((p) => (
          <div
            key={p.id}
            onClick={() => setOpenPost(p)}
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${p.color}55, ${p.color}22)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              cursor: "pointer",
              overflow: "hidden",
            }}
          >
            {p.petEmoji}
            {p.contest && (
              <div style={{ position: "absolute", top: 5, right: 5, fontSize: 13 }}>🏆</div>
            )}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                background: "linear-gradient(transparent, rgba(0,0,0,0.45))",
                padding: "16px 6px 5px",
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Heart size={10} color="#fff" fill="#fff" />
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.likes}</span>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
            Bu filtrede henüz gönderi yok.
          </div>
        )}
      </div>
    </div>
  );
}

function ContestScreen() {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);
  const [view, setView] = useState("leaderboard"); // leaderboard | suggest
  const [suggestions, setSuggestions] = useState(CATEGORY_SUGGESTIONS);
  const [voted, setVoted] = useState({});
  const [newIdea, setNewIdea] = useState("");

  const voteFor = (id) => {
    if (voted[id]) return;
    setSuggestions((s) => s.map((c) => (c.id === id ? { ...c, votes: c.votes + 1 } : c)));
    setVoted((v) => ({ ...v, [id]: true }));
  };

  const addSuggestion = () => {
    if (!newIdea.trim()) return;
    setSuggestions((s) => [...s, { id: Date.now(), name: newIdea, votes: 1 }]);
    setVoted((v) => ({ ...v, [Date.now()]: true }));
    setNewIdea("");
  };

  return (
    <div>
      <TopBar title="Yarışma" />
      <div style={{ padding: "14px 14px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, background: C.cream, borderRadius: 13, padding: 4, border: `1px solid ${C.line}` }}>
          {[
            { key: "leaderboard", label: "Bu Ay" },
            { key: "suggest", label: "Gelecek Ay İçin Öner" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                flex: 1,
                padding: "9px 8px",
                borderRadius: 10,
                border: "none",
                background: view === t.key ? C.mustard : "transparent",
                color: view === t.key ? C.cream : C.inkSoft,
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {view === "leaderboard" && (
      <div style={{ padding: "0 14px 90px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCat(c)}
              style={{
                whiteSpace: "nowrap",
                padding: "9px 14px",
                borderRadius: 12,
                border: `2px solid ${activeCat === c ? C.mustard : C.line}`,
                background: activeCat === c ? "#FDF1D8" : C.cream,
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <div
          style={{
            background: `linear-gradient(135deg, ${C.pine}, #0f3a30)`,
            borderRadius: 20,
            padding: "20px 18px",
            color: C.cream,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Award size={18} />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14 }}>Ay sonuna 6 gün kaldı</span>
          </div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, opacity: 0.85, lineHeight: 1.5 }}>
            Ayın her günü oy kullanırsan "Sadık Oy Veren" rozetini kazanırsın.
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: C.ink, marginBottom: 10 }}>Sıralama — {activeCat}</div>
        {leaderboard.map((r) => (
          <div
            key={r.rank}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: C.cream,
              border: `1px solid ${C.line}`,
              borderRadius: 14,
              padding: "10px 14px",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 14,
                width: 24,
                textAlign: "center",
                color: r.rank === 1 ? C.mustard : C.inkSoft,
              }}
            >
              {r.rank}
            </div>
            <BlobAvatar emoji={r.emoji} size={38} color={r.rank === 1 ? C.mustard : C.pine} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{r.pet}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{r.human}</div>
            </div>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: C.pine }}>{r.votes} oy</div>
          </div>
        ))}
      </div>
      )}

      {view === "suggest" && (
        <div style={{ padding: "0 14px 90px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
            Gelecek ayın yarışma kategorilerini topluluk seçiyor. En çok oy alan 4 kategori bir sonraki aya taşınır.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <input
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSuggestion()}
              placeholder="Yeni kategori öner..."
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: 12,
                border: `2px solid ${C.line}`,
                fontFamily: FONT_BODY,
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={addSuggestion}
              style={{
                background: C.mustard,
                border: "none",
                borderRadius: 12,
                padding: "0 16px",
                color: C.cream,
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Öner
            </button>
          </div>

          {suggestions
            .slice()
            .sort((a, b) => b.votes - a.votes)
            .map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: C.cream,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  marginBottom: 8,
                }}
              >
                {i < 4 && <Sparkles size={15} color={C.mustard} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{s.name}</div>
                  {i < 4 && <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.mustardDark }}>Şu an kazanıyor</div>}
                </div>
                <button
                  onClick={() => voteFor(s.id)}
                  disabled={voted[s.id]}
                  style={{
                    background: voted[s.id] ? "#EFEAE0" : C.pine,
                    color: voted[s.id] ? C.inkSoft : C.cream,
                    border: "none",
                    borderRadius: 10,
                    padding: "7px 12px",
                    fontFamily: FONT_DISPLAY,
                    fontSize: 12,
                    cursor: voted[s.id] ? "default" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {voted[s.id] ? "Oylandı" : `Oy Ver · ${s.votes}`}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ProfileScreen({ user, myPets, isPrivate, setIsPrivate, onOpenProfile }) {
  const [listOpen, setListOpen] = useState(null);
  const [dmPolicy, setDmPolicy] = useState("everyone");
  return (
    <div>
      <TopBar title="Profilim" />
      <div style={{ padding: "20px 18px 90px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <BlobAvatar emoji="🙂" size={64} color={C.pine} />
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink }}>{user.name || "Ayşe Yılmaz"}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>@ayseyilmaz · {myPets.length} dost</div>
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Dostlarım</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
          {myPets.map((p) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: C.cream,
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                padding: "8px 12px",
              }}
            >
              <span style={{ fontSize: 18 }}>{p.emoji}</span>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>{p.name}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `2px dashed ${C.line}`,
              borderRadius: 12,
              padding: "8px 12px",
              color: C.inkSoft,
              cursor: "pointer",
            }}
          >
            <Plus size={15} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>Ekle</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          <div
            onClick={() => setListOpen("followers")}
            style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>128</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takipçi</div>
          </div>
          <div
            onClick={() => setListOpen("following")}
            style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>64</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takip</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>9</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Gönderi</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isPrivate ? <Lock size={18} color={C.pine} /> : <Globe size={18} color={C.mustard} />}
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>
                {isPrivate ? "Kapalı Profil" : "Açık Profil"}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>
                {isPrivate ? "Sadece takipçilerin görebilir" : "Herkes görebilir"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsPrivate((v) => !v)}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              border: "none",
              background: isPrivate ? C.pine : C.line,
              position: "relative",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: C.cream,
                position: "absolute",
                top: 3,
                left: isPrivate ? 21 : 3,
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.5, marginBottom: 20 }}>
          Not: Yarışmaya girdiğin gönderiler, profil ayarından bağımsız olarak oy verilebilmesi için her zaman herkese açık olur.
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Kimler mesaj atabilir?</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "everyone", label: "Herkes" },
            { key: "followers", label: "Sadece Takipçiler" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDmPolicy(opt.key)}
              style={{
                flex: 1,
                padding: "11px 8px",
                borderRadius: 12,
                border: `2px solid ${dmPolicy === opt.key ? C.mustard : C.line}`,
                background: dmPolicy === opt.key ? "#FDF1D8" : C.cream,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 12.5,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {listOpen && (
        <FollowListModal
          title={listOpen === "followers" ? "Takipçiler" : "Takip Edilenler"}
          list={MOCK_FOLLOWERS}
          onClose={() => setListOpen(null)}
          onOpenProfile={(u) => {
            setListOpen(null);
            onOpenProfile && onOpenProfile(u);
          }}
        />
      )}
    </div>
  );
}

function ChatScreen({ conversation, onBack }) {
  const [messages, setMessages] = useState(conversation.messages);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "me", text }]);
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar
        title={conversation.human}
        onBack={onBack}
        right={<BlobAvatar emoji={conversation.petEmoji} size={30} color={conversation.color} />}
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: m.from === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.from === "me" ? C.mustard : C.cream,
                color: m.from === "me" ? C.cream : C.ink,
                border: m.from === "me" ? "none" : `1px solid ${C.line}`,
                fontFamily: FONT_BODY,
                fontSize: 13.5,
                lineHeight: 1.4,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 14px 18px",
          borderTop: `1px solid ${C.line}`,
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Bir mesaj yaz..."
          style={{
            flex: 1,
            padding: "11px 14px",
            borderRadius: 20,
            border: `2px solid ${C.line}`,
            fontFamily: FONT_BODY,
            fontSize: 13.5,
            outline: "none",
          }}
        />
        <button
          onClick={send}
          style={{
            background: C.mustard,
            border: "none",
            borderRadius: "50%",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.cream,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function InboxScreen({ onBack, onOpenChat }) {
  return (
    <div>
      <TopBar title="Mesajlar" onBack={onBack} />
      <div style={{ padding: "8px 10px", maxWidth: 480, margin: "0 auto" }}>
        {CONVERSATIONS.map((c) => (
          <div
            key={c.id}
            onClick={() => onOpenChat(c)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 10px",
              borderRadius: 14,
              cursor: "pointer",
            }}
          >
            <BlobAvatar emoji={c.petEmoji} color={c.color} size={46} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{c.human}</div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12.5,
                  color: c.unread ? C.ink : C.inkSoft,
                  fontWeight: c.unread ? 700 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.lastMessage}
              </div>
            </div>
            {c.unread && <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.coral, flexShrink: 0 }} />}
          </div>
        ))}
        {CONVERSATIONS.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
            Henüz bir mesajın yok.
          </div>
        )}
      </div>
    </div>
  );
}

function SearchScreen({ onBack, onOpenProfile }) {
  const [q, setQ] = useState("");
  const results = q.trim()
    ? MOCK_USERS.filter(
        (u) => u.handle.toLowerCase().includes(q.toLowerCase().replace("@", "")) || u.human.toLowerCase().includes(q.toLowerCase())
      )
    : [];

  return (
    <div>
      <TopBar title="Ara" onBack={onBack} />
      <div style={{ padding: "14px 18px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="@kullaniciadi veya isim ara"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 14px",
              borderRadius: 14,
              border: `2px solid ${C.line}`,
              fontFamily: FONT_BODY,
              fontSize: 14,
              color: C.ink,
              background: C.cream,
              outline: "none",
            }}
          />
        </div>

        {!q && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "30px 0" }}>
            Bir kullanıcı adı yazmaya başla 🔍
          </div>
        )}

        {q && results.length === 0 && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "30px 0" }}>
            "{q}" ile eşleşen kimse bulunamadı.
          </div>
        )}

        {results.map((u) => (
          <div
            key={u.handle}
            onClick={() => onOpenProfile(u)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 8px",
              borderRadius: 14,
              cursor: "pointer",
            }}
          >
            <BlobAvatar emoji={u.petEmoji} color={u.color} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{u.human}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>
                {u.handle} · {u.pet} ile birlikte
              </div>
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{u.followers} takipçi</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowListModal({ title, list, onClose, onOpenProfile }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px 24px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "65vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>
        {list.map((u) => (
          <div
            key={u.handle}
            onClick={() => {
              onClose();
              onOpenProfile(u);
            }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 4px", cursor: "pointer" }}
          >
            <BlobAvatar emoji={u.petEmoji} color={u.color} size={40} />
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{u.human}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{u.handle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentsModal({ post, onClose, onAddComment }) {
  const [text, setText] = useState("");
  const [comments, setComments] = useState([
    { human: "Selin Y.", text: "Çok tatlıymış! 😍" },
    { human: "Barış K.", text: "Bizimki de tam böyle yapıyor" },
  ]);

  const send = () => {
    if (!text.trim()) return;
    setComments((c) => [...c, { human: "Sen", text }]);
    setText("");
    onAddComment && onAddComment();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>
            {post.pet} için yorumlar ({comments.length})
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <BlobAvatar emoji="🙂" size={32} color={C.pine} />
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, color: C.ink }}>{c.human}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 0 18px", borderTop: `1px solid ${C.line}` }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Bir yorum yaz..."
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 20,
              border: `2px solid ${C.line}`,
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              outline: "none",
            }}
          />
          <button
            onClick={send}
            style={{
              background: C.mustard,
              border: "none",
              borderRadius: 20,
              padding: "0 18px",
              color: C.cream,
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

function UserProfileView({ target, onBack, onOpenProfile, onOpenChat, isGuest, onRequireAuth }) {
  const [following, setFollowing] = useState(false);
  const [listOpen, setListOpen] = useState(null);
  return (
    <div>
      <TopBar title={target.human} onBack={onBack} />
      <div style={{ padding: "20px 18px 40px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <BlobAvatar emoji={target.petEmoji} size={64} color={target.color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink }}>{target.human}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{target.handle || "@" + target.human.toLowerCase().replace(/\s/g, "")}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button
            onClick={() => (isGuest ? onRequireAuth() : setFollowing((v) => !v))}
            style={{
              flex: 1,
              background: following ? C.cream : C.pine,
              color: following ? C.pine : C.cream,
              border: `1.5px solid ${C.pine}`,
              borderRadius: 10,
              padding: "9px 14px",
              fontFamily: FONT_DISPLAY,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {following ? "Takipte" : "Takip Et"}
          </button>
          <button
            onClick={() =>
              isGuest
                ? onRequireAuth()
                : onOpenChat({
                    id: "new-" + target.handle,
                    handle: target.handle,
                    human: target.human,
                    petEmoji: target.petEmoji,
                    color: target.color,
                    messages: [],
                  })
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: C.cream,
              color: C.ink,
              border: `1.5px solid ${C.line}`,
              borderRadius: 10,
              padding: "9px 14px",
              fontFamily: FONT_DISPLAY,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            <Mail size={14} /> Mesaj
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          <div
            onClick={() => setListOpen("followers")}
            style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>94</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takipçi</div>
          </div>
          <div
            onClick={() => setListOpen("following")}
            style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>41</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takip</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>1</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Dost</div>
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Dostu</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "10px 14px",
          }}
        >
          <span style={{ fontSize: 22 }}>{target.petEmoji}</span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5 }}>{target.pet}</span>
        </div>
      </div>

      {listOpen && (
        <FollowListModal
          title={listOpen === "followers" ? "Takipçiler" : "Takip Edilenler"}
          list={MOCK_FOLLOWERS}
          onClose={() => setListOpen(null)}
          onOpenProfile={(u) => {
            setListOpen(null);
            onOpenProfile(u);
          }}
        />
      )}
    </div>
  );
}

function ComplaintModal({ onClose }) {
  const [sent, setSent] = useState(false);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: "22px 22px 0 0",
          padding: "20px 20px 28px",
          width: "100%",
          maxWidth: 480,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>
            {sent ? "Bildirim alındı" : "Bu gönderiyi şikayet et"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>
        {!sent ? (
          <>
            {["Uygunsuz içerik", "Spam", "Hayvana zarar/ihmal görüntüsü", "Sahte hesap"].map((r) => (
              <button
                key={r}
                onClick={() => setSent(true)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "13px 14px",
                  marginBottom: 8,
                  borderRadius: 12,
                  border: `1px solid ${C.line}`,
                  background: C.cream,
                  fontFamily: FONT_BODY,
                  fontSize: 13.5,
                  color: C.ink,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </>
        ) : (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}>
            Şikayetin ekibimize iletildi, inceleyeceğiz. İçerik otomatik filtreden de geçirilir.
          </div>
        )}
      </div>
    </div>
  );
}

function SignupPromptModal({ onClose, onSignup }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: 22,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>🐾</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink, marginBottom: 6 }}>
          Bunun için üye olman lazım
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>
          Gözatmaya devam edebilirsin, ama beğenmek, oy vermek, yorum yapmak ve paylaşım eklemek için bir hesap gerekiyor.
        </div>
        <PrimaryButton style={{ width: "100%", marginBottom: 10 }} onClick={onSignup}>
          Ücretsiz üye ol
        </PrimaryButton>
        <div onClick={onClose} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, cursor: "pointer" }}>
          Gözatmaya devam et
        </div>
      </div>
    </div>
  );
}

function NavBar({ tab, setTab, isGuest, onRequireAuth, onAdd }) {
  const items = [
    { key: "feed", label: "Akış", icon: Home },
    { key: "discover", label: "Keşfet", icon: Compass },
    { key: "add", label: "Ekle", icon: Plus },
    { key: "contest", label: "Yarışma", icon: Trophy },
    { key: "profile", label: "Profil", icon: User },
  ];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: C.cream,
        borderTop: `1px solid ${C.line}`,
        display: "flex",
        padding: "10px 8px 14px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.key;
        const isAdd = it.key === "add";
        const guestGated = isGuest && (it.key === "add" || it.key === "profile");
        return (
          <button
            key={it.key}
            onClick={() => {
              if (guestGated) return onRequireAuth();
              if (it.key === "add") return onAdd();
              setTab(it.key);
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active ? C.mustard : C.inkSoft,
            }}
          >
            {isAdd ? (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "40% 60% 60% 40% / 45% 45% 55% 55%",
                  background: C.mustard,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -18,
                  boxShadow: `0 3px 0 ${C.mustardDark}`,
                }}
              >
                <Icon size={20} color={C.cream} />
              </div>
            ) : (
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            )}
            <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: active ? 800 : 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Root ----------
export default function FlickletPrototype() {
  const [phase, setPhase] = useState("auth"); // auth -> setup -> app
  const [tab, setTab] = useState("feed");
  const [user, setUser] = useState({ name: "" });
  const [isPrivate, setIsPrivate] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [posts, setPosts] = useState(seedPosts);
  const [myPets, setMyPets] = useState([{ name: "Mustafa", emoji: "🐱" }]);
  const [isGuest, setIsGuest] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);

  const requireAuth = () => setPromptOpen(true);

  const publishPost = (draft) => {
    setPosts((prev) => [
      {
        id: Date.now(),
        human: user.name || "Sen",
        pet: draft.pet,
        petEmoji: draft.petEmoji,
        caption: draft.caption,
        likes: 0,
        comments: 0,
        contest: draft.contest,
        votes: 0,
        color: draft.color,
        isMine: true,
      },
      ...prev,
    ]);
    setCreating(false);
    setTab("feed");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: FONT_BODY,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus { border-color: ${C.mustard} !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {phase === "auth" && (
        <AuthScreen
          onDone={(sessionData) => {
            if (sessionData?.access_token) {
              setSession(sessionData);
            }
            setPhase("setup");
          }}
          onGuest={() => {
            setIsGuest(true);
            setPhase("app");
          }}
        />
      )}
      {phase === "setup" && (
        <ProfileSetupScreen
          onDone={() => {
            setIsGuest(false);
            setPhase("app");
          }}
        />
      )}
      {phase === "app" && !creating && !viewingProfile && !searching && !inboxOpen && !activeChat && (
        <>
          {tab === "feed" && (
            <FeedScreen
              posts={posts}
              onOpenComplaint={() => setComplaintOpen(true)}
              onOpenProfile={(p) => setViewingProfile(p)}
              onCompose={() => setCreating(true)}
              onOpenSearch={() => setSearching(true)}
              onOpenInbox={() => setInboxOpen(true)}
              myFirstPet={myPets[0]}
              isGuest={isGuest}
              onRequireAuth={requireAuth}
            />
          )}
          {tab === "contest" && <ContestScreen />}
          {tab === "discover" && (
            <DiscoverScreen
              posts={posts}
              onOpenProfile={(p) => setViewingProfile(p)}
              onOpenComplaint={() => setComplaintOpen(true)}
              onOpenComments={() => {}}
              isGuest={isGuest}
              onRequireAuth={requireAuth}
            />
          )}
          {tab === "profile" && (
            <ProfileScreen
              user={user}
              myPets={myPets}
              isPrivate={isPrivate}
              setIsPrivate={setIsPrivate}
              onOpenProfile={(p) => setViewingProfile(p)}
            />
          )}
          <NavBar tab={tab} setTab={setTab} isGuest={isGuest} onRequireAuth={requireAuth} onAdd={() => setCreating(true)} />
        </>
      )}
      {phase === "app" && creating && (
        <CreatePostScreen myPets={myPets} onPublish={publishPost} onCancel={() => setCreating(false)} />
      )}
      {phase === "app" && viewingProfile && !activeChat && (
        <UserProfileView
          target={viewingProfile}
          onBack={() => setViewingProfile(null)}
          onOpenProfile={(p) => setViewingProfile(p)}
          onOpenChat={(c) => setActiveChat(c)}
          isGuest={isGuest}
          onRequireAuth={requireAuth}
        />
      )}
      {phase === "app" && searching && (
        <SearchScreen
          onBack={() => setSearching(false)}
          onOpenProfile={(u) => {
            setSearching(false);
            setViewingProfile(u);
          }}
        />
      )}
      {phase === "app" && inboxOpen && !activeChat && (
        <InboxScreen onBack={() => setInboxOpen(false)} onOpenChat={(c) => setActiveChat(c)} />
      )}
      {phase === "app" && activeChat && (
        <ChatScreen
          conversation={activeChat}
          onBack={() => setActiveChat(null)}
        />
      )}

      {complaintOpen && <ComplaintModal onClose={() => setComplaintOpen(false)} />}
      {promptOpen && (
        <SignupPromptModal
          onClose={() => setPromptOpen(false)}
          onSignup={() => {
            setPromptOpen(false);
            setIsGuest(false);
            setPhase("auth");
          }}
        />
      )}
    </div>
  );
}
