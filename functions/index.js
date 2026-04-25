const { onValueCreated } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase, ServerValue } = require("firebase-admin/database");
const { GoogleGenAI } = require("@google/genai");

initializeApp();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

exports.sendGeminiWelcomeMessage = onValueCreated(
  "/rooms/main/members/{uid}",
  async (event) => {
    const uid = event.params.uid;
    const db = getDatabase();

    try {
      const userSnapshot = await db.ref(`publicProfiles/${uid}`).get();
      const userProfile = userSnapshot.val() || {};

      const username = userProfile.username || userProfile.email || "new user";

      const alreadyWelcomedSnapshot = await db
        .ref(`botWelcomedUsers/${uid}`)
        .get();

      if (alreadyWelcomedSnapshot.exists()) {
        return;
      }

      const prompt = `
You are a friendly chatbot inside a class chatroom app.
A new user named "${username}" just joined the ALL chatroom.
Write one short welcome message in English.
Keep it under 25 words.
Do not mention that you are Gemini.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      });

      const botText =
        response.text || `Welcome ${username}! Glad to have you here.`;

      const newMessageRef = db.ref("roomMessages/main").push();

      await newMessageRef.set({
        username: "ChatGPT Bot",
        uid: "chatgpt-bot",
        type: "bot",
        text: botText,
        roomId: "main",
        createdAt: ServerValue.TIMESTAMP,
      });

      await db.ref(`botWelcomedUsers/${uid}`).set(true);
    } catch (error) {
      console.error("Gemini welcome message failed:", error);

      const fallbackMessageRef = db.ref("roomMessages/main").push();

      await fallbackMessageRef.set({
        username: "ChatGPT Bot",
        uid: "chatgpt-bot",
        type: "bot",
        text: "Welcome! Glad to have you here.",
        roomId: "main",
        createdAt: ServerValue.TIMESTAMP,
      });
    }
  }
);