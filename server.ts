import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateMUETCards, evaluateWritingResponse, analyzeAudioResponse, evaluateSimulatedTextResponse } from "./services/geminiService.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/generateMUETCards", async (req, res) => {
    try {
      const { type, model, language } = req.body;
      const cards = await generateMUETCards(type, model, language);
      res.json(cards);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  app.post("/api/evaluateWriting", async (req, res) => {
    try {
      const { essay, taskType, topic, model, language } = req.body;
      const feedback = await evaluateWritingResponse(essay, taskType, topic, model, language);
      res.json(feedback);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  app.post("/api/analyzeAudio", async (req, res) => {
    try {
      const { base64Audio, mimeType, question, durationSpoken, timeLimit, model, language } = req.body;
      const result = await analyzeAudioResponse(base64Audio, mimeType, question, durationSpoken, timeLimit, model, language);
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  app.post("/api/evaluateSimulatedText", async (req, res) => {
    try {
      const { textResponse, question, durationSpoken, timeLimit, model, language } = req.body;
      const result = await evaluateSimulatedTextResponse(textResponse, question, durationSpoken, timeLimit, model, language);
      res.json(result);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'An error occurred' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
