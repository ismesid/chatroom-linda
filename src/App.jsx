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
  set,
  update,
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

const DEFAULT_ROOM_ID = "main";

const DEFAULT_ROOM = {
  id: DEFAULT_ROOM_ID,
  name: "ALL",
  description: "Main chatroom",
  avatar: "S",
};

function App() {
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  const selectedRoom = useMemo(() => {
    return rooms.find((room) => room.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setRooms([]);
        setMessages([]);
        setSelectedRoomId("");
        return;
      }

      const username = currentUser.displayName || currentUser.email;

      const updates = {
        [`users/${currentUser.uid}/email`]: currentUser.email,
        [`users/${currentUser.uid}/username`]: username,
        [`users/${currentUser.uid}/updatedAt`]: serverTimestamp(),

        [`rooms/${DEFAULT_ROOM_ID}/name`]: DEFAULT_ROOM.name,
        [`rooms/${DEFAULT_ROOM_ID}/description`]: DEFAULT_ROOM.description,
        [`rooms/${DEFAULT_ROOM_ID}/avatar`]: DEFAULT_ROOM.avatar,
        [`rooms/${DEFAULT_ROOM_ID}/members/${currentUser.uid}`]: true,

        [`userRooms/${currentUser.uid}/${DEFAULT_ROOM_ID}`]: true,
      };

      await update(ref(database), updates);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setRooms([]);
      setSelectedRoomId("");
      return;
    }

    const userRoomsRef = ref(database, `userRooms/${user.uid}`);

    const unsubscribeUserRooms = onValue(userRoomsRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setRooms([]);
        setSelectedRoomId("");
        return;
      }

      const roomIds = Object.keys(data);

      roomIds.forEach((roomId) => {
        const roomRef = ref(database, `rooms/${roomId}`);

        onValue(roomRef, (roomSnapshot) => {
          const roomData = roomSnapshot.val();

          if (!roomData) return;

          setRooms((prevRooms) => {
            const nextRoom = {
              id: roomId,
              name: roomData.name,
              description: roomData.description || "Group chat",
              avatar: roomData.avatar || roomData.name?.[0]?.toUpperCase() || "?",
              createdBy: roomData.createdBy || "",
              members: roomData.members || {},
            };

            const exists = prevRooms.some((room) => room.id === roomId);

            if (exists) {
              return prevRooms.map((room) =>
                room.id === roomId ? nextRoom : room
              );
            }

            return [...prevRooms, nextRoom];
          });
        });
      });
    });

    return () => unsubscribeUserRooms();
  }, [user]);

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

    useEffect(() => {
    if (!user || !selectedRoomId) {
      setMessages([]);
      return;
    }

    const path = `roomMessages/${selectedRoomId}`;

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

    if (!selectedRoom || !selectedRoom.members?.[user.uid]) {
      alert("You are not a member of this chatroom.");
      return;
    }

    const messagesRef = ref(database, `roomMessages/${selectedRoomId}`);

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

    const path = `roomMessages/${selectedRoomId}/${msg.id}`;

    try {
      await remove(ref(database, path));
    } catch (error) {
      console.error("Delete message failed:", error);
      alert("Delete failed: " + error.message);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    const trimmedName = newGroupName.trim();

    if (!trimmedName) {
      alert("Please enter a group name.");
      return;
    }

    const newRoomRef = push(ref(database, "rooms"));
    const newRoomId = newRoomRef.key;

    const newRoom = {
      name: trimmedName,
      description: "New group",
      avatar: trimmedName[0].toUpperCase(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      members: {
        [user.uid]: true,
      },
    };

  try {
    const updates = {
      [`rooms/${newRoomId}`]: newRoom,
      [`userRooms/${user.uid}/${newRoomId}`]: true,
    };

    await update(ref(database), updates);

    setSelectedRoomId(newRoomId);
    setNewGroupName("");
    setActivePanel(null);
    setIsMenuOpen(false);
    setIsMobileChatOpen(true);
  } catch (error) {
    console.error("Create group failed:", error);
    alert("Create group failed: " + error.message);
  }
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

            <div className="header-avatar">{selectedRoom?.avatar || "?"}</div>

            <div>
              <h1>{selectedRoom?.name || "Chatroom"}</h1>
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
            <p>Welcome to {selectedRoom?.name || "this room"}</p>
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
            placeholder={`Write a message to ${selectedRoom?.name || "this room"}...`}
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