const GEMINI_MODEL = "gemini-2.0-flash";

export type Classification = {
  category: "Handbags" | "Clothing" | "Jewelry" | "Unsorted";
  subCategory: string | null; // e.g. "Shirts", "Dresses" (Clothing only)
  brand: string | null; // e.g. "Gucci", null if not identifiable
};

const PROMPT = `You are sorting product photos for a resale/inventory business.
Look at the image and identify:
1. category: one of "Handbags", "Clothing", "Jewelry", or "Unsorted" (use Unsorted if it's not a product photo of these types)
2. subCategory: for Clothing only, a short type like "Shirts", "Dresses", "Pants" (null for other categories)
3. brand: the brand name if a visible logo/label identifies it, otherwise null. Do not guess.

Respond ONLY with compact JSON: {"category":"...","subCategory":null,"brand":null}`;

export async function classifyImage(
  base64Image: string,
  mimeType: string,
  apiKey: string
): Promise<Classification> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no classification text");

  const parsed = JSON.parse(text);
  return {
    category: parsed.category ?? "Unsorted",
    subCategory: parsed.subCategory ?? null,
    brand: parsed.brand ?? null,
  };
}
