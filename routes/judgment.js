const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
const SYSTEM_PROMPT = require("../middleware/systemPrompt");

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/judgment/analyze
 * Body: { base64: "<base64 PDF string>", filename: "case.pdf" }
 * Returns: structured judgment analysis JSON
 */
router.post("/analyze", async (req, res) => {
  const { base64, filename } = req.body;

  if (!base64) {
    return res.status(400).json({ error: "No PDF data provided. Send base64 field." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server." });
  }

  try {
    console.log(`📄 Analyzing judgment: ${filename || "unknown.pdf"}`);

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Analyze this High Court judgment document and extract all critical administrative action items, directives, compliance requirements, and risk factors. Return the structured JSON analysis.",
            },
          ],
        },
      ],
    });

    const rawText = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const clean = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    console.log(`✅ Analysis complete for: ${filename || "unknown.pdf"}`);
    return res.json({ success: true, data: parsed });

  } catch (err) {
    console.error("❌ Analysis error:", err.message);

    if (err instanceof SyntaxError) {
      return res.status(502).json({ error: "AI returned malformed JSON. Try again." });
    }
    if (err.status === 401) {
      return res.status(401).json({ error: "Invalid Anthropic API key." });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: "Rate limit reached. Please wait and retry." });
    }

    return res.status(500).json({ error: err.message || "Failed to analyze judgment." });
  }
});

module.exports = router;