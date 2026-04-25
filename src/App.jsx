// src/App.jsx
import { useEffect, useMemo, useState } from "react";
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

const DEFAULT_ROOMS = [
  {
    id: "main",
    name: "SITCON",
    description: "Main chatroom",
    avatar: "S",
  },
  {
    id: "project",
    name: "Project Team",
    description: "Local demo group",
    avatar: "P",
  },
  {
    id: "general",
    name: "General",
    description: "Local demo group",
    avatar: "G",
  },
];

function App() {
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");

  const [rooms, setRooms] = useState(DEFAULT_ROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState(DEFAULT_ROOMS[0].id);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const selectedRoom = useMemo(() => {
    return rooms.find((room) => room.id === selectedRoomId) || rooms[0];
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !selectedRoomId) {
      setMessages([]);
      return;
    }

    const path =
      selectedRoomId === "main"
        ? "messages"
        : `rooms/${selectedRoomId}/messages`;

    const messagesRef = query(ref(database, path), orderByChild("createdAt"));

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
  }, [user, selectedRoomId]);

  const visibleMessages = messages.filter((msg) => {
    return !blockedUsers.some((blocked) => blocked.uid === msg.uid);
  });

  const lastMessageText = visibleMessages.length
    ? visibleMessages[visibleMessages.length - 1].text
    : "No messages yet";

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
    setMessages([]);
    setIsMenuOpen(false);
    setActivePanel(null);
  };

  const handleSelectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    setMessage("");
    setIsMobileChatOpen(true);
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

    const path =
      selectedRoomId === "main"
        ? "messages"
        : `rooms/${selectedRoomId}/messages`;

    const messagesRef = ref(database, path);

    try {
      await push(messagesRef, {
        username: user.displayName || user.email,
        uid: user.uid,
        text: trimmedMessage,
        roomId: selectedRoomId,
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

    const path =
      selectedRoomId === "main"
        ? `messages/${msg.id}`
        : `rooms/${selectedRoomId}/messages/${msg.id}`;

    try {
      await remove(ref(database, path));
    } catch (error) {
      console.error("Delete message failed:", error);
      alert("Delete failed: " + error.message);
    }
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();

    const trimmedName = newGroupName.trim();

    if (!trimmedName) {
      alert("Please enter a group name.");
      return;
    }

    const newRoom = {
      id: `local-${Date.now()}`,
      name: trimmedName,
      description: "New group",
      avatar: trimmedName[0].toUpperCase(),
    };

    setRooms((prevRooms) => [newRoom, ...prevRooms]);
    setSelectedRoomId(newRoom.id);
    setNewGroupName("");
    setActivePanel(null);
    setIsMenuOpen(false);
    setIsMobileChatOpen(true);
  };

  const handleBlockUser = (msg) => {
    if (msg.uid === user.uid) {
      alert("You cannot block yourself.");
      return;
    }

    const alreadyBlocked = blockedUsers.some((blocked) => blocked.uid === msg.uid);

    if (alreadyBlocked) {
      alert("This user is already blocked.");
      return;
    }

    setBlockedUsers((prevUsers) => [
      ...prevUsers,
      {
        uid: msg.uid,
        username: msg.username,
      },
    ]);
  };

  const handleUnblockUser = (uid) => {
    setBlockedUsers((prevUsers) =>
      prevUsers.filter((blocked) => blocked.uid !== uid)
    );
  };

  const getInitial = (name) => {
    if (!name) return "?";
    return name[0].toUpperCase();
  };

  if (!user) {
    return (
      <div className="app auth-page">
        <div className="auth-card">
          <h1>{authMode === "login" ? "Login" : "Register"}</h1>
          <p className="auth-subtitle">
            Please login before entering the chatroom.
          </p>

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
    <div className="chat-shell">
      {isMenuOpen && (
        <div
          className="menu-backdrop"
          onClick={() => {
            setIsMenuOpen(false);
            setActivePanel(null);
          }}
        />
      )}

      <aside className={`side-menu ${isMenuOpen ? "open" : ""}`}>
        <div className="side-menu-profile">
          <div className="profile-avatar">
            {getInitial(user.displayName || user.email)}
          </div>

          <div>
            <h2>{user.displayName || "Linda Lin"}</h2>
            <p>{user.email}</p>
          </div>
        </div>

        <button
          className="menu-item"
          onClick={() => setActivePanel("profile")}
        >
          <span>◎</span>
          My Profile
        </button>

        <button
          className="menu-item"
          onClick={() => setActivePanel("newGroup")}
        >
          <span>👥</span>
          New Group
        </button>

        <button
          className="menu-item"
          onClick={() => setActivePanel("blocked")}
        >
          <span>🚫</span>
          Blocked Users
        </button>

        <button className="menu-item logout-menu-item" onClick={handleLogout}>
          <span>↪</span>
          Logout
        </button>

        {activePanel === "profile" && (
          <div className="drawer-panel">
            <h3>My Profile</h3>
            <p className="panel-label">Display name</p>
            <p className="panel-value">{user.displayName || "No display name"}</p>

            <p className="panel-label">Email</p>
            <p className="panel-value">{user.email}</p>

            <p className="panel-label">User ID</p>
            <p className="panel-value small-text">{user.uid}</p>
          </div>
        )}

        {activePanel === "newGroup" && (
          <div className="drawer-panel">
            <h3>New Group</h3>
            <form onSubmit={handleCreateGroup} className="new-group-form">
              <input
                type="text"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button type="submit">Create</button>
            </form>
          </div>
        )}

        {activePanel === "blocked" && (
          <div className="drawer-panel">
            <h3>Blocked Users</h3>

            {blockedUsers.length === 0 ? (
              <p className="empty-panel-text">No blocked users.</p>
            ) : (
              blockedUsers.map((blocked) => (
                <div className="blocked-user-row" key={blocked.uid}>
                  <span>{blocked.username}</span>
                  <button onClick={() => handleUnblockUser(blocked.uid)}>
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="menu-footer">Chatroom</div>
      </aside>

      <section
        className={`chat-list-panel ${
          isMobileChatOpen ? "mobile-hidden" : ""
        }`}
      >
        <div className="chat-list-top">
          <button className="icon-button" onClick={() => setIsMenuOpen(true)}>
            ☰
          </button>

          <div className="search-box">Search</div>
        </div>

        <div className="room-list">
          {rooms.map((room, index) => (
            <button
              className={`room-item ${
                selectedRoomId === room.id ? "active" : ""
              }`}
              key={room.id}
              onClick={() => handleSelectRoom(room.id)}
            >
              <div className="room-avatar">{room.avatar}</div>

              <div className="room-info">
                <div className="room-title-row">
                  <h3>{room.name}</h3>
                  <span>{index === 0 ? "04:49" : ""}</span>
                </div>

                <p>
                  {room.id === selectedRoomId
                    ? lastMessageText
                    : room.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <main className={`chat-panel ${isMobileChatOpen ? "mobile-open" : ""}`}>
        <header className="chat-panel-header">
          <div className="chat-header-left">
            <button
              className="mobile-back-button"
              onClick={() => setIsMobileChatOpen(false)}
            >
              ←
            </button>

            <div className="header-avatar">{selectedRoom.avatar}</div>

            <div>
              <h1>{selectedRoom.name}</h1>
              <p>
                {visibleMessages.length === 0
                  ? "No messages"
                  : `${visibleMessages.length} messages`}
              </p>
            </div>
          </div>

          <div className="chat-header-actions">
            <button className="icon-button">⌕</button>
            <button className="icon-button">⋮</button>
          </div>
        </header>

        <div className="pinned-message">
          <div className="pinned-line" />
          <div>
            <strong>Pinned message</strong>
            <p>Welcome to {selectedRoom.name}</p>
          </div>
        </div>

        <section className="message-list">
          {visibleMessages.length === 0 ? (
            <p className="empty-message">No messages yet. Start the conversation!</p>
          ) : (
            visibleMessages.map((msg) => (
              <div
                className={`message-row ${
                  msg.uid === user.uid ? "my-message-row" : ""
                }`}
                key={msg.id}
              >
                <div className="message-avatar">{getInitial(msg.username)}</div>

                <div
                  className={`message-card ${
                    msg.uid === user.uid ? "my-message" : ""
                  }`}
                >
                  <div className="message-top">
                    <span className="message-user">{msg.username}</span>

                    <div className="message-actions">
                      {msg.uid !== user.uid && (
                        <button
                          className="mini-action-button"
                          onClick={() => handleBlockUser(msg)}
                        >
                          Block
                        </button>
                      )}

                      {msg.uid === user.uid && (
                        <button
                          className="mini-action-button"
                          onClick={() => handleDeleteMessage(msg)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="message-text">{msg.text}</p>
                </div>
              </div>
            ))
          )}
        </section>

        <form className="message-form" onSubmit={handleSendMessage}>
          <button className="attach-button" type="button">
            📎
          </button>

          <input
            type="text"
            placeholder={`Write a message to ${selectedRoom.name}...`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <button type="submit" className="send-button">
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;