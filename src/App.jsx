// src/App.jsx
import { useEffect, useState } from "react";
import {
  ref,
  push,
  remove,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
} from "firebase/database";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, database } from "./firebase";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    const messagesRef = query(ref(database, "messages"), orderByChild("createdAt"));

    const unsubscribeMessages = onValue(messagesRef, (snapshot) => {
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

    return () => unsubscribeMessages();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }

      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Authentication failed:", error);
      setAuthError(error.message);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError("");

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);

      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Google login failed:", error);
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setMessage("");
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      alert("Please enter a message.");
      return;
    }

    const messagesRef = ref(database, "messages");

    try {
      await push(messagesRef, {
        username: user.displayName || user.email,
        uid: user.uid,
        text: trimmedMessage,
        createdAt: serverTimestamp(),
      });

      setMessage("");
    } catch (error) {
      console.error("Send message failed:", error);
      alert("Send failed: " + error.message);
    }
  };

  const handleDeleteMessage = async (msg) => {
  if (!user) {
    alert("Please login first.");
    return;
  }

  if (msg.uid !== user.uid) {
    alert("You can only delete your own messages.");
    return;
  }

  const confirmDelete = window.confirm("Delete this message?");

  if (!confirmDelete) {
    return;
  }

  try {
    await remove(ref(database, `messages/${msg.id}`));
  } catch (error) {
    console.error("Delete message failed:", error);
    alert("Delete failed: " + error.message);
  }
};

  if (!user) {
    return (
      <div className="app">
        <div className="auth-card">
          <h1>{authMode === "login" ? "Login" : "Register"}</h1>
          <p className="auth-subtitle">Please login before entering the chatroom.</p>

          <form className="auth-form" onSubmit={handleAuth}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {authError && <p className="auth-error">{authError}</p>}

            <button type="submit">
              {authMode === "login" ? "Login" : "Register"}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            className="google-login-button"
            type="button"
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </button>

          <button
            className="switch-auth-button"
            type="button"
            onClick={() => {
              setAuthError("");
              setAuthMode(authMode === "login" ? "register" : "login");
            }}
          >
            {authMode === "login"
              ? "No account? Register here"
              : "Already have an account? Login here"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="chatroom">
        <header className="chat-header">
          <div>
            <h1>Chatroom</h1>
            <p>Logged in as {user.displayName || user.email}</p>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <section className="message-list">
          {messages.length === 0 ? (
            <p className="empty-message">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => (
              <div
                className={`message-card ${
                  msg.uid === user.uid ? "my-message" : ""
                }`}
                key={msg.id}
              >
                <div className="message-top">
                  <span className="message-user">{msg.username}</span>

                  {msg.uid === user.uid && (
                    <button
                      className="delete-message-button"
                      type="button"
                      onClick={() => handleDeleteMessage(msg)}
                    >
                      Delete
                    </button>
                  )}
                </div>

                <p className="message-text">{msg.text}</p>
              </div>
            ))
          )}
        </section>

        <form className="message-form logged-in-form" onSubmit={handleSendMessage}>
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