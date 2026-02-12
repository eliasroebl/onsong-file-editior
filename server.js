const express = require("express");
const Anthropic = require("@anthropic-ai/sdk").default;
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `Du bist ein spezialisierter Song Sheet Editor. Du arbeitest mit OnSong/ChordPro-Notation.

Deine EINZIGE Aufgabe: Nimm ein Song Sheet und eine Änderungsanweisung entgegen, und gib das KOMPLETTE Song Sheet zurück mit NUR den angewiesenen Änderungen.

WICHTIGE REGELN:
1. Gib IMMER das komplette Song Sheet zurück - niemals nur Teile davon.
2. Ändere NUR genau das, was in der Anweisung steht. NICHTS anderes.
3. Bewahre das EXAKTE Format: Zeilenumbrüche, Leerzeichen, {c: ...} Tags, {textfill: ...} Tags, |. Markierungen - ALLES muss identisch bleiben.
4. Akkorde stehen in eckigen Klammern [Akkord] - ändere nur die Akkorde die explizit genannt werden.
5. Ändere KEINE Texte, es sei denn es wird explizit angewiesen.
6. Ändere KEINE Sektionsnamen ({c: ...}), es sei denn es wird explizit angewiesen.
7. Wenn eine Anweisung unklar ist, mache die naheliegendste Interpretation.
8. Gib NUR das Song Sheet zurück - keine Erklärungen, keine Kommentare, kein Markdown-Codeblock.

Beispiel-Format das du erhältst und zurückgibst:
{c: Verse}
Halle[A]luja! Halle[E/G#]luja!
|. [F#m]Du großer [F#m/E]Gott Du re[D]gierst`;

app.post("/api/edit", async (req, res) => {
  const { songSheet, instruction, apiKey } = req.body;

  if (!songSheet || !instruction) {
    return res.status(400).json({ error: "Song Sheet und Anweisung werden benötigt." });
  }

  if (!apiKey) {
    return res.status(400).json({ error: "API Key wird benötigt." });
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Hier ist das Song Sheet:\n\n${songSheet}\n\n---\n\nAnweisung: ${instruction}`,
        },
      ],
    });

    const result = message.content[0].text;
    res.json({ result });
  } catch (err) {
    console.error("API Error:", err.message);
    if (err.status === 401) {
      return res.status(401).json({ error: "Ungültiger API Key." });
    }
    res.status(500).json({ error: "Fehler bei der AI-Verarbeitung: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
