// src/App.jsx
import { useEffect, useState } from "react";
import { ref, push, onValue, serverTimestamp, query, orderByChild } from "firebase/database";
import { database } from "./firebase";
import "./App.css";

function App() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const messagesRef = query(ref(database, "messages"), orderByChild("createdAt"));

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        const messageList = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));

        setMessages(messageList);
      } else {
        setMessages([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const trimmedMessage = message.trim();

    if (!trimmedUsername) {
      alert("Please enter your name.");
      return;
    }

    if (!trimmedMessage) {
      alert("Please enter a message.");
      return;
    }

    const messagesRef = ref(database, "messages");

    await push(messagesRef, {
      username: trimmedUsername,
      text: trimmedMessage,
      createdAt: serverTimestamp(),
    });

    setMessage("");
  };

  return (
    <div className="app">
      <div className="chatroom">
        <header className="chat-header">
          <div>
            <h1>Chatroom</h1>
            <p>Firebase Realtime Chat</p>
          </div>
        </header>

        <section className="message-list">
          {messages.length === 0 ? (
            <p className="empty-message">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => (
              <div className="message-card" key={msg.id}>
                <div className="message-top">
                  <span className="message-user">{msg.username}</span>
                </div>
                <p className="message-text">{msg.text}</p>
              </div>
            ))
          )}
        </section>

        <form className="message-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;