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
