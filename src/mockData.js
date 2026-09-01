// Faz B/C'de gerçek veriye bağlanacak, henüz mock kalan veriler.
export const CATEGORIES = ["En Tatlı Bakış", "En Komik An", "En İyi Kostüm", "En Tembel Poz"];

export const MOCK_FOLLOWERS = [
  { handle: "@seliny", human: "Selin Y.", petEmoji: "🐰", color: "#7A5CFF" },
  { handle: "@bariskk", human: "Barış K.", petEmoji: "🐕", color: "#17594B" },
  { handle: "@hardensouls", human: "Harden S.", petEmoji: "🐈‍⬛", color: "#17594B" },
];

export const TRENDING = [
  { tag: "#TembelPoz", count: "2.4B" },
  { tag: "#KostümGünü", count: "1.8B" },
  { tag: "#ParkGünü", count: "980" },
  { tag: "#SabahRutini", count: "740" },
  { tag: "#BeslenmeSaati", count: "512" },
  { tag: "#YeniAksesuar", count: "310" },
];

export const CONVERSATIONS = [
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

export const CATEGORY_SUGGESTIONS = [
  { id: 1, name: "En İyi Uyku Pozu", votes: 214 },
  { id: 2, name: "En Enerjik An", votes: 187 },
  { id: 3, name: "En Şaşkın Bakış", votes: 156 },
  { id: 4, name: "İkili Dostluk (2 hayvan bir arada)", votes: 98 },
];

export const leaderboard = [
  { rank: 1, pet: "Boncuk", human: "Deniz A.", emoji: "🐹", votes: 501 },
  { rank: 2, pet: "Mustafa", human: "Aslı K.", emoji: "🐱", votes: 342 },
  { rank: 3, pet: "Pamuk", human: "Selin Y.", emoji: "🐰", votes: 298 },
];

export const MOCK_USERS = [
  { handle: "@hardensouls", human: "Harden S.", pet: "Kaplan", petEmoji: "🐈‍⬛", color: "#17594B", followers: 412 },
  { handle: "@asli.k", human: "Aslı K.", pet: "Mustafa", petEmoji: "🐱", color: "#F4A100", followers: 128 },
  { handle: "@emret", human: "Emre T.", pet: "Zeytin", petEmoji: "🐶", color: "#17594B", followers: 89 },
  { handle: "@seliny", human: "Selin Y.", pet: "Pamuk", petEmoji: "🐰", color: "#7A5CFF", followers: 64 },
  { handle: "@denizA", human: "Deniz A.", pet: "Boncuk", petEmoji: "🐹", color: "#FF6F5C", followers: 256 },
  { handle: "@bariskk", human: "Barış K.", pet: "Şeker", petEmoji: "🐕", color: "#17594B", followers: 143 },
];
