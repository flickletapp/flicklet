export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { text, imageUrl } = req.body || {};
  const input = [];
  if (text) input.push({ type: "text", text });
  if (imageUrl) input.push({ type: "image_url", image_url: { url: imageUrl } });

  if (input.length === 0) {
    res.status(200).json({ flagged: false, categories: [] });
    return;
  }

  try {
    const r = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(502).json({ error: data.error?.message || "Moderasyon servisi hata verdi" });
      return;
    }
    const result = data.results?.[0];
    const flagged = !!result?.flagged;
    const categories = flagged ? Object.entries(result.categories).filter(([, v]) => v).map(([k]) => k) : [];
    res.status(200).json({ flagged, categories });
  } catch (e) {
    res.status(500).json({ error: "Moderasyon servisine ulaşılamadı" });
  }
}
