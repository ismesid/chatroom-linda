// src/App.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ref,
  push,
  set,
  remove,
  onValue,
  serverTimestamp,
  query,
  orderByChild,
  get,
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

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const generateGeminiWelcomeMessage = async (username) => {
  if (!GEMINI_API_KEY) {
    return `Welcome ${username || "new user"}! Glad to have you here.`;
  }

  try {
    const prompt = `
You are a friendly chatbot inside a class chatroom app.
A new user named "${username || "new user"}" just joined the ALL chatroom.
Write one short welcome message in English.
Keep it under 25 words.
Do not mention that you are Gemini.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Gemini API request failed");
    }

    const data = await response.json();

    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      `Welcome ${username || "new user"}! Glad to have you here.`
    );
  } catch (error) {
    console.error("Gemini welcome message failed:", error);
    return `Welcome ${username || "new user"}! Glad to have you here.`;
  }
};

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

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const [openEmojiMessageId, setOpenEmojiMessageId] = useState(null);

  const emojiGroups = [
    {
      title: "Popular",
      emojis: ["❤️", "😂", "👍", "😭", "😍", "😮", "😡", "👏", "🔥", "🎉"],
    },
    {
      title: "Faces",
      emojis: ["😀", "😁", "🤣", "😊", "🥰", "😘", "😎", "😐", "😅", "😇", "😴", "🤔"],
    },
    {
      title: "Gestures",
      emojis: ["👍", "👎", "👌", "🙏", "👏", "🙌", "🤝", "💪", "👀", "🤌"],
    },
    {
      title: "Symbols",
      emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "⭐", "✨", "💯", "✅"],
    },
  ];

  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchText, setMessageSearchText] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [roomSearchText, setRoomSearchText] = useState("");

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");

  const [blockedMap, setBlockedMap] = useState({});
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [renameRoomName, setRenameRoomName] = useState("");

  const [userProfiles, setUserProfiles] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    photoURL: "",
    username: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const messageListRef = useRef(null);
  const messageEndRef = useRef(null);
  const messageRefs = useRef({});
  const imageInputRef = useRef(null);

  const ensureDefaultRoomForUser = async (currentUser, shouldWelcome = false) => {
    if (!currentUser) return;

    const defaultUsername = currentUser.displayName || currentUser.email || "";
    const latestPhotoURL = currentUser.photoURL || "";
    const latestUsername = defaultUsername || "User";

    // 第一階段：先保證 ALL 群組一定建立成功
    await update(ref(database), {
      [`users/${currentUser.uid}/email`]: currentUser.email || "",
      [`users/${currentUser.uid}/username`]: latestUsername,
      [`users/${currentUser.uid}/photoURL`]: latestPhotoURL,
      [`users/${currentUser.uid}/updatedAt`]: serverTimestamp(),

      [`publicProfiles/${currentUser.uid}/photoURL`]: latestPhotoURL,
      [`publicProfiles/${currentUser.uid}/username`]: latestUsername,
      [`publicProfiles/${currentUser.uid}/email`]: currentUser.email || "",

      [`rooms/${DEFAULT_ROOM_ID}/name`]: DEFAULT_ROOM.name,
      [`rooms/${DEFAULT_ROOM_ID}/description`]: DEFAULT_ROOM.description,
      [`rooms/${DEFAULT_ROOM_ID}/avatar`]: DEFAULT_ROOM.avatar,
      [`rooms/${DEFAULT_ROOM_ID}/members/${currentUser.uid}`]: true,

      [`userRooms/${currentUser.uid}/${DEFAULT_ROOM_ID}`]: true,
    });

    // 不是剛註冊的人，不發 bot 歡迎
    if (!shouldWelcome) {
      return;
    }

    // 第二階段：Gemini bot 另外處理，失敗也不能影響 ALL
    try {
      const alreadyWelcomedSnapshot = await get(
        ref(database, `botWelcomedUsers/${currentUser.uid}/${DEFAULT_ROOM_ID}`)
      );

      if (alreadyWelcomedSnapshot.exists()) {
        return;
      }

      const botText = await generateGeminiWelcomeMessage(
        latestUsername || currentUser.email || "new user"
      );

      const botMessageRef = push(
        ref(database, `roomMessages/${DEFAULT_ROOM_ID}`)
      );

      await set(botMessageRef, {
        username: "Gemini Bot",
        uid: "gemini-bot",
        type: "bot",
        text: botText,
        roomId: DEFAULT_ROOM_ID,
        createdAt: serverTimestamp(),
      });

      await set(
        ref(database, `botWelcomedUsers/${currentUser.uid}/${DEFAULT_ROOM_ID}`),
        true
      );
    } catch (error) {
      console.error("Bot welcome failed, but ALL room was already created:", error);
    }
  };

  const selectedRoom = useMemo(() => {
    return rooms.find((room) => room.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  const filteredRooms = useMemo(() => {
    const keyword = roomSearchText.trim().toLowerCase();

    if (!keyword) return rooms;

    return rooms.filter((room) => {
      const searchableText = `${room.name || ""} ${room.description || ""}`.toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [rooms, roomSearchText]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setRooms([]);
        setMessages([]);
        setSelectedRoomId("");
        return;
      }

      await ensureDefaultRoomForUser(currentUser, false);

      const defaultUsername = currentUser.displayName || currentUser.email;
      const userRef = ref(database, `users/${currentUser.uid}`);
      const userSnapshot = await get(userRef);
      const existingProfile = userSnapshot.val();
      const latestPhotoURL = existingProfile?.photoURL || currentUser.photoURL || "";
      const latestUsername = existingProfile?.username || defaultUsername || "";

      const updates = {
        [`users/${currentUser.uid}/email`]:
          existingProfile?.email || currentUser.email || "",
        [`users/${currentUser.uid}/username`]:
          existingProfile?.username || defaultUsername || "",
        [`users/${currentUser.uid}/photoURL`]:
          existingProfile?.photoURL || currentUser.photoURL || "",
        [`users/${currentUser.uid}/phone`]: existingProfile?.phone || "",
        [`users/${currentUser.uid}/address`]: existingProfile?.address || "",
        [`users/${currentUser.uid}/updatedAt`]: serverTimestamp(),

        [`publicProfiles/${currentUser.uid}/photoURL`]: latestPhotoURL,
        [`publicProfiles/${currentUser.uid}/username`]: latestUsername,
        [`publicProfiles/${currentUser.uid}/email`]: existingProfile?.email || currentUser.email || "",

        
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

    const unsubscribeUserRooms = onValue(userRoomsRef, async (snapshot) => {
      const data = snapshot.val();

      if (!data || !data[DEFAULT_ROOM_ID]) {
        await ensureDefaultRoomForUser(user, false);
        return;
      }

      const roomIds = Object.keys(data);
      const loadedRooms = [];

      for (const roomId of roomIds) {
        const roomSnapshot = await get(ref(database, `rooms/${roomId}`));
        const roomData = roomSnapshot.val();

        if (!roomData) continue;

        loadedRooms.push({
          id: roomId,
          name: roomData.name,
          description: roomData.description || "Group chat",
          avatar: roomData.avatar || roomData.name?.[0]?.toUpperCase() || "?",
          createdBy: roomData.createdBy || "",
          members: roomData.members || {},
        });
      }

      setRooms(loadedRooms);

      if (!selectedRoomId && loadedRooms.length > 0) {
        const defaultRoom =
          loadedRooms.find((room) => room.id === DEFAULT_ROOM_ID) || loadedRooms[0];

        setSelectedRoomId(defaultRoom.id);
      }
    });

    return () => unsubscribeUserRooms();
  }, [user]);
  
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const userRef = ref(database, `users/${user.uid}`);

    const unsubscribeProfile = onValue(userRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setUserProfile(null);
        return;
      }

      setUserProfile(data);
      setProfileForm({
        photoURL: data.photoURL || "",
        username: data.username || "",
        email: data.email || user.email || "",
        phone: data.phone || "",
        address: data.address || "",
      });
    });

    return () => unsubscribeProfile();
  }, [user]);

  useEffect(() => {
    if (!selectedRoomId && rooms.length > 0) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!user || !selectedRoomId) {
      return;
    }

    const selectedRoomRef = ref(database, `rooms/${selectedRoomId}`);

    const unsubscribeSelectedRoom = onValue(selectedRoomRef, (snapshot) => {
      const roomData = snapshot.val();

      if (!roomData) {
        return;
      }

      const updatedRoom = {
        id: selectedRoomId,
        name: roomData.name,
        description: roomData.description || "Group chat",
        avatar: roomData.avatar || roomData.name?.[0]?.toUpperCase() || "?",
        createdBy: roomData.createdBy || "",
        members: roomData.members || {},
      };

      setRooms((prevRooms) => {
        const roomExists = prevRooms.some((room) => room.id === selectedRoomId);

        if (!roomExists) {
          return prevRooms;
        }

        return prevRooms.map((room) =>
          room.id === selectedRoomId ? updatedRoom : room
        );
      });
    });

    return () => unsubscribeSelectedRoom();
  }, [user, selectedRoomId]);

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

  const isBlockedBetween = (uidA, uidB) => {
    if (!uidA || !uidB) return false;

    return (
      blockedMap?.[uidA]?.[uidB] === true ||
      blockedMap?.[uidB]?.[uidA] === true
    );
  };

  const visibleMessages = messages.filter((msg) => {
    if (!user) return true;
    if (msg.uid === user.uid) return true;

    return !isBlockedBetween(user.uid, msg.uid);
  });

  const normalizedMessageSearchText = messageSearchText.trim().toLowerCase();

  const messageSearchResults = normalizedMessageSearchText
    ? visibleMessages.filter((msg) =>
        msg.type !== "image" &&
        String(msg.text || "").toLowerCase().includes(normalizedMessageSearchText)
      )
    : [];

  const activeSearchMessageId =
    messageSearchResults.length > 0
      ? messageSearchResults[activeSearchIndex]?.id
      : null;

  useEffect(() => {
    if (!user) {
      setUserProfiles({});
      return;
    }

    const publicProfilesRef = ref(database, "publicProfiles");

    const unsubscribeProfiles = onValue(
      publicProfilesRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        console.log("publicProfiles:", data);
        setUserProfiles(data);
      },
      (error) => {
        console.error("Read publicProfiles failed:", error);
      }
    );

    return () => unsubscribeProfiles();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBlockedMap({});
      return;
    }

    const blocksRef = ref(database, "blocks");

    const unsubscribeBlocks = onValue(blocksRef, (snapshot) => {
      setBlockedMap(snapshot.val() || {});
    });

    return () => unsubscribeBlocks();
  }, [user]);

  useEffect(() => {
    setRenameRoomName(selectedRoom?.name || "");
  }, [selectedRoom?.id, selectedRoom?.name]);

  useLayoutEffect(() => {
    if (!selectedRoomId) return;
    if (messageSearchText.trim()) return;

    let frameId;
    let frameCount = 0;

    const scrollToBottom = () => {
      const messageList = messageListRef.current;

      if (!messageList) return;

      // 直接用一個很大的值，避免 scrollHeight 當下還沒完全更新
      messageList.scrollTop = 999999999;

      messageList.scrollTo({
        top: 999999999,
        behavior: "auto",
      });

      messageEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    };

    const keepScrolling = () => {
      scrollToBottom();
      frameCount += 1;

      // 連續多幀強制滑到底，處理登入後 ALL 訊息還在載入的情況
      if (frameCount < 20) {
        frameId = requestAnimationFrame(keepScrolling);
      }
    };

    frameId = requestAnimationFrame(keepScrolling);

    const timer1 = setTimeout(scrollToBottom, 100);
    const timer2 = setTimeout(scrollToBottom, 300);
    const timer3 = setTimeout(scrollToBottom, 700);
    const timer4 = setTimeout(scrollToBottom, 1200);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [
    user?.uid,
    selectedRoomId,
    selectedRoom?.id,
    isMobileChatOpen,
    visibleMessages[visibleMessages.length - 1]?.id,
  ]);

  useEffect(() => {
    if (!activeSearchMessageId) return;

    const targetElement = messageRefs.current[activeSearchMessageId];

    if (!targetElement) return;

    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeSearchMessageId]);

  const lastMessage = visibleMessages[visibleMessages.length - 1];

  const lastMessageText = lastMessage
    ? lastMessage.type === "image"
      ? "[Image]"
      : lastMessage.type === "system"
        ? lastMessage.text
        : lastMessage.text || "No messages yet"
    : "No messages yet";

  const roomMembers = selectedRoom?.members
    ? Object.keys(selectedRoom.members).map((uid) => ({
        uid,
        username: userProfiles[uid]?.username || "Unknown user",
        email: userProfiles[uid]?.email || "",
        photoURL: userProfiles[uid]?.photoURL || "",
      }))
    : [];
  
  const otherMemberInTwoPersonRoom =
    roomMembers.length === 2
      ? roomMembers.find((member) => member.uid !== user?.uid)
      : null;

  const isTwoPersonBlockedRoom =
    roomMembers.length === 2 &&
    otherMemberInTwoPersonRoom &&
    isBlockedBetween(user?.uid, otherMemberInTwoPersonRoom.uid);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setAuthError("Please enter both email and password.");
      return;
    }

    try {
      let result;

      if (authMode === "register") {
        result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

        // 只有新註冊帳號才發 Gemini Bot 歡迎
        await ensureDefaultRoomForUser(result.user, true);

        setSelectedRoomId(DEFAULT_ROOM_ID);
      } else {
        result = await signInWithEmailAndPassword(auth, trimmedEmail, password);

        // 舊帳號登入只補 ALL，不發歡迎
        await ensureDefaultRoomForUser(result.user, false);
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
      const result = await signInWithPopup(auth, provider);

      await ensureDefaultRoomForUser(result.user, false);

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
    setEditingMessageId(null);
    setEditingText("");
    setIsMenuOpen(false);
    setActivePanel(null);
  };

  const handleSelectRoom = (roomId) => {
    setSelectedRoomId(roomId);
    setMessage("");
    setEditingMessageId(null);
    setEditingText("");
    setIsMessageSearchOpen(false);
    setMessageSearchText("");
    setActiveSearchIndex(0);
    setIsMobileChatOpen(true);
  };

  const handleOpenMessageSearch = () => {
    setIsMessageSearchOpen(true);
  };

  const handleCloseMessageSearch = () => {
    setIsMessageSearchOpen(false);
    setMessageSearchText("");
    setActiveSearchIndex(0);
  };

  const handleMessageSearchChange = (e) => {
    setMessageSearchText(e.target.value);
    setActiveSearchIndex(0);
  };

  const handleNextSearchResult = () => {
    if (messageSearchResults.length === 0) return;

    setActiveSearchIndex((prevIndex) =>
      prevIndex + 1 >= messageSearchResults.length ? 0 : prevIndex + 1
    );
  };

  const handlePrevSearchResult = () => {
    if (messageSearchResults.length === 0) return;

    setActiveSearchIndex((prevIndex) =>
      prevIndex - 1 < 0 ? messageSearchResults.length - 1 : prevIndex - 1
    );
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    const messageToSend = message;

    if (messageToSend.length === 0) {
      alert("Please enter a message.");
      return;
    }

    if (!selectedRoom || !selectedRoom.members?.[user.uid]) {
      alert("You are not a member of this chatroom.");
      return;
    }

    if (isTwoPersonBlockedRoom) {
      alert("You can no longer chat with this user.");
      return;
    }

    const messagesRef = ref(database, `roomMessages/${selectedRoomId}`);

    try {
      await push(messagesRef, {
        username: userProfile?.username || user.displayName || user.email,
        uid: user.uid,
        text: messageToSend,
        roomId: selectedRoomId,
        createdAt: serverTimestamp(),
      });

      setMessage("");
    } catch (error) {
      console.error("Send message failed:", error);
      alert("Send failed: " + error.message);
    }
  };

  const handleSendImageMessage = async (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!user) {
      alert("Please login first.");
      e.target.value = "";
      return;
    }

    if (!selectedRoom || !selectedRoom.members?.[user.uid]) {
      alert("You are not a member of this chatroom.");
      e.target.value = "";
      return;
    }

    if (isTwoPersonBlockedRoom) {
      alert("You can no longer chat with this user.");
      e.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      e.target.value = "";
      return;
    }

    if (file.size > 800 * 1024) {
      alert("Image is too large. Please choose an image smaller than 800KB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const imageURL = reader.result;
        const messagesRef = ref(database, `roomMessages/${selectedRoomId}`);

        await push(messagesRef, {
          username: userProfile?.username || user.displayName || user.email,
          uid: user.uid,
          type: "image",
          imageURL,
          text: "",
          roomId: selectedRoomId,
          createdAt: serverTimestamp(),
        });

        const snapshot = await get(messagesRef);
        const data = snapshot.val() || {};

        const myImageMessages = Object.entries(data)
          .map(([id, value]) => ({
            id,
            ...value,
          }))
          .filter((msg) => msg.uid === user.uid && msg.type === "image")
          .sort((a, b) => {
            const timeA = typeof a.createdAt === "number" ? a.createdAt : 0;
            const timeB = typeof b.createdAt === "number" ? b.createdAt : 0;
            return timeA - timeB;
          });

        const extraCount = myImageMessages.length - 5;

        if (extraCount > 0) {
          const oldImages = myImageMessages.slice(0, extraCount);

          const deleteUpdates = {};

          oldImages.forEach((oldImage) => {
            deleteUpdates[`roomMessages/${selectedRoomId}/${oldImage.id}`] = {
              username: oldImage.username || userProfile?.username || user.displayName || user.email,
              uid: oldImage.uid,
              type: "system",
              text: "Image removed because the image limit was exceeded.",
              roomId: selectedRoomId,
              createdAt: oldImage.createdAt || Date.now(),
            };
          });

          await update(ref(database), deleteUpdates);
        }
      } catch (error) {
        console.error("Send image failed:", error);
        alert("Send image failed: " + error.message);
      } finally {
        e.target.value = "";
      }
    };

    reader.readAsDataURL(file);
  };

  const handleStartEditMessage = (msg) => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    if (msg.uid !== user.uid) {
      alert("You can only edit your own messages.");
      return;
    }

    setEditingMessageId(msg.id);
    setEditingText(msg.text || "");
  };

  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSaveEditMessage = async (e, msg) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (msg.uid !== user.uid) {
      alert("You can only edit your own messages.");
      return;
    }

    const trimmedText = editingText.trim();

    if (!trimmedText) {
      alert("Message cannot be empty.");
      return;
    }

    if (trimmedText === msg.text) {
      handleCancelEditMessage();
      return;
    }

    const path = `roomMessages/${selectedRoomId}/${msg.id}`;

    try {
      await update(ref(database, path), {
        text: trimmedText,
        edited: true,
        editedAt: serverTimestamp(),
      });

      handleCancelEditMessage();
    } catch (error) {
      console.error("Edit message failed:", error);
      alert("Edit failed: " + error.message);
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

      if (editingMessageId === msg.id) {
        handleCancelEditMessage();
      }
    } catch (error) {
      console.error("Delete message failed:", error);
      alert("Delete failed: " + error.message);
    }
  };

  const handleToggleReaction = async (msg, emoji) => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!selectedRoom || !selectedRoom.members?.[user.uid]) {
      alert("You are not a member of this chatroom.");
      return;
    }

    if (msg.type === "system") {
      return;
    }

    const hasReacted = msg.reactions?.[emoji]?.[user.uid] === true;

    const reactionPath = `roomMessages/${selectedRoomId}/${msg.id}/reactions/${emoji}/${user.uid}`;

    try {
      await update(ref(database), {
        [reactionPath]: hasReacted ? null : true,
      });

      setOpenEmojiMessageId(null);
    } catch (error) {
      console.error("Toggle reaction failed:", error);
      alert("Reaction failed: " + error.message);
    }
  };

  const getReactionList = (msg) => {
    if (!msg.reactions) return [];

    return Object.entries(msg.reactions)
      .map(([emoji, users]) => ({
        emoji,
        count: users ? Object.keys(users).length : 0,
        reactedByMe: users?.[user?.uid] === true,
      }))
      .filter((reaction) => reaction.count > 0);
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

  const handleAddMemberToRoom = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!selectedRoomId || !selectedRoom) {
      alert("Please select a chatroom first.");
      return;
    }

    if (!selectedRoom.members?.[user.uid]) {
      alert("Only room members can add new people.");
      return;
    }

    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      alert("Please enter an email.");
      return;
    }

    try {
      const profilesSnapshot = await get(ref(database, "publicProfiles"));
      const profiles = profilesSnapshot.val() || {};

      const foundEntry = Object.entries(profiles).find(([, profile]) => {
        return profile.email?.toLowerCase() === trimmedEmail;
      });

      if (!foundEntry) {
        alert("User not found. Make sure this user has logged in before.");
        return;
      }

      const [newMemberUid, newMemberProfile] = foundEntry;

      if (selectedRoom.members?.[newMemberUid]) {
        alert("This user is already in this chatroom.");
        return;
      }

      const updates = {
        [`rooms/${selectedRoomId}/members/${newMemberUid}`]: true,
        [`userRooms/${newMemberUid}/${selectedRoomId}`]: true,
      };

      await update(ref(database), updates);

      setInviteEmail("");
      alert(`${newMemberProfile.username || trimmedEmail} has been added.`);
    } catch (error) {
      console.error("Add member failed:", error);
      alert("Add member failed: " + error.message);
    }
  };

  const handleRenameRoom = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!selectedRoomId || !selectedRoom) {
      alert("Please select a chatroom first.");
      return;
    }

    if (!selectedRoom.members?.[user.uid]) {
      alert("Only room members can rename this group.");
      return;
    }

    const trimmedName = renameRoomName.trim();

    if (!trimmedName) {
      alert("Please enter a group name.");
      return;
    }

    try {
      await update(ref(database), {
        [`rooms/${selectedRoomId}/name`]: trimmedName,
        [`rooms/${selectedRoomId}/avatar`]: trimmedName[0].toUpperCase(),
      });

      alert("Group name updated.");
    } catch (error) {
      console.error("Rename room failed:", error);
      alert("Rename failed: " + error.message);
    }
  };

  const handleRemoveMemberFromRoom = async (memberUid) => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    if (!selectedRoomId || !selectedRoom) {
      alert("Please select a chatroom first.");
      return;
    }

    if (!selectedRoom.members?.[user.uid]) {
      alert("Only room members can remove people.");
      return;
    }

    if (memberUid === selectedRoom.createdBy) {
      alert("You cannot remove the group owner.");
      return;
    }

    if (memberUid === user.uid) {
      alert("You cannot remove yourself here.");
      return;
    }

    const memberName =
      userProfiles[memberUid]?.username ||
      userProfiles[memberUid]?.email ||
      "this member";

    const confirmRemove = window.confirm(`Remove ${memberName} from this group?`);

    if (!confirmRemove) {
      return;
    }

    try {
      await update(ref(database), {
        [`rooms/${selectedRoomId}/members/${memberUid}`]: null,
        [`userRooms/${memberUid}/${selectedRoomId}`]: null,
      });

      alert(`${memberName} has been removed.`);
    } catch (error) {
      console.error("Remove member failed:", error);
      alert("Remove failed: " + error.message);
    }
  };

  const handleOpenProfile = () => {
      setProfileForm({
        photoURL: userProfile?.photoURL || user.photoURL || "",
        username: userProfile?.username || user.displayName || user.email || "",
        email: userProfile?.email || user.email || "",
        phone: userProfile?.phone || "",
        address: userProfile?.address || "",
      });

      setIsProfileModalOpen(true);
      setIsMenuOpen(false);
      setActivePanel(null);
    };

    const handleProfileInputChange = (e) => {
      const { name, value } = e.target;

      setProfileForm((prevForm) => ({
        ...prevForm,
        [name]: value,
      }));
    };

    const handleProfileImageUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    if (file.size > 800 * 1024) {
      alert("Image is too large. Please choose an image smaller than 800KB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setProfileForm((prevForm) => ({
        ...prevForm,
        photoURL: reader.result,
      }));
    };

    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (!user) {
      alert("Please login first.");
      return;
    }

    const trimmedUsername = profileForm.username.trim();
    const trimmedEmail = profileForm.email.trim();

    if (!trimmedUsername || !trimmedEmail) {
      alert("Username and email are required.");
      return;
    }

    try {
      const profileUpdates = {
        [`users/${user.uid}/photoURL`]: profileForm.photoURL,
        [`users/${user.uid}/username`]: trimmedUsername,
        [`users/${user.uid}/email`]: trimmedEmail,
        [`users/${user.uid}/phone`]: profileForm.phone.trim(),
        [`users/${user.uid}/address`]: profileForm.address.trim(),
        [`users/${user.uid}/updatedAt`]: serverTimestamp(),

        [`publicProfiles/${user.uid}/photoURL`]: profileForm.photoURL,
        [`publicProfiles/${user.uid}/username`]: trimmedUsername,
        [`publicProfiles/${user.uid}/email`]: trimmedEmail,
      };

      await update(ref(database), profileUpdates);
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error("Save profile failed:", error);
      alert("Save profile failed: " + error.message);
    }
  };

  const handleBlockUser = async (msg) => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    if (msg.uid === user.uid) {
      alert("You cannot block yourself.");
      return;
    }

    if (blockedMap?.[user.uid]?.[msg.uid]) {
      alert("This user is already blocked.");
      return;
    }

    const confirmBlock = window.confirm(`Block ${msg.username}?`);

    if (!confirmBlock) {
      return;
    }

    try {
      await update(ref(database), {
        [`blocks/${user.uid}/${msg.uid}`]: true,
      });
    } catch (error) {
      console.error("Block user failed:", error);
      alert("Block failed: " + error.message);
    }
  };

  const handleUnblockUser = async (uid) => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    try {
      await update(ref(database), {
        [`blocks/${user.uid}/${uid}`]: null,
      });
    } catch (error) {
      console.error("Unblock user failed:", error);
      alert("Unblock failed: " + error.message);
    }
  };

  const blockedUsersForPanel = Object.keys(blockedMap?.[user?.uid] || {}).map(
    (uid) => ({
      uid,
      username: userProfiles[uid]?.username || "Unknown user",
      email: userProfiles[uid]?.email || "",
      photoURL: userProfiles[uid]?.photoURL || "",
    })
  );

  const getInitial = (name) => {
    if (!name) return "?";
    return name[0].toUpperCase();
  };

  const looksLikeCode = (text = "") => {
    const value = String(text);

    return (
      /<\/?[a-zA-Z][\s\S]*?>/.test(value) ||
      value.includes("{") ||
      value.includes("}") ||
      value.includes(";") ||
      value.includes("=>") ||
      value.includes("function ") ||
      value.includes("const ") ||
      value.includes("let ") ||
      value.includes("import ") ||
      value.includes("return ")
    );
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

      {isProfileModalOpen && (
        <div
          className="profile-modal-backdrop"
          onClick={() => setIsProfileModalOpen(false)}
        >
          <div
            className="profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <button
                type="button"
                className="profile-modal-icon-button"
                onClick={() => setIsProfileModalOpen(false)}
              >
                ←
              </button>

              <h2>Info</h2>

              <button
                type="button"
                className="profile-modal-icon-button"
                onClick={() => setIsProfileModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="profile-form" onSubmit={handleSaveProfile}>
              <div className="profile-preview">
                <div className="profile-preview-avatar">
                  {profileForm.photoURL ? (
                    <img src={profileForm.photoURL} alt="Profile preview" />
                  ) : (
                    getInitial(profileForm.username || profileForm.email)
                  )}
                </div>

                <h3>{profileForm.username || "User"}</h3>
                <p>online</p>
              </div>

              <label className="profile-field">
                <span>Profile picture</span>

                <div className="profile-file-row">
                  <label className="profile-file-button" htmlFor="profileImageInput">
                    Choose image
                  </label>

                  <span className="profile-file-text">
                    {profileForm.photoURL ? "Image selected" : "No image selected"}
                  </span>

                  <input
                    id="profileImageInput"
                    className="profile-file-input"
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageUpload}
                  />
                </div>
              </label>

              <label className="profile-field">
                <span>Username</span>
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={profileForm.username}
                  onChange={handleProfileInputChange}
                />
              </label>

              <label className="profile-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={profileForm.email}
                  onChange={handleProfileInputChange}
                />
              </label>

              <label className="profile-field">
                <span>Phone number</span>
                <input
                  type="text"
                  name="phone"
                  placeholder="Phone number"
                  value={profileForm.phone}
                  onChange={handleProfileInputChange}
                />
              </label>

              <label className="profile-field">
                <span>Address</span>
                <input
                  type="text"
                  name="address"
                  placeholder="Address"
                  value={profileForm.address}
                  onChange={handleProfileInputChange}
                />
              </label>

              <button type="submit" className="profile-save-button">
                Save
              </button>
            </form>
          </div>
        </div>
      )}

      {isRoomInfoOpen && (
        <div
          className="room-info-modal-backdrop"
          onClick={() => setIsRoomInfoOpen(false)}
        >
          <div
            className="room-info-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="room-info-modal-header">
              <div>
                <h2>{selectedRoom?.name || "Chatroom"}</h2>
                <p>{roomMembers.length} members</p>
              </div>

              <button
                type="button"
                className="room-info-close-button"
                onClick={() => setIsRoomInfoOpen(false)}
              >
                ×
              </button>
            </div>

            <form className="rename-room-form" onSubmit={handleRenameRoom}>
              <h3>Rename group</h3>

              <div className="rename-room-row">
                <input
                  type="text"
                  placeholder="Group name"
                  value={renameRoomName}
                  onChange={(e) => setRenameRoomName(e.target.value)}
                />

                <button type="submit">Save</button>
              </div>
            </form>

            <div className="room-info-section">
              <h3>Members</h3>

              {roomMembers.length === 0 ? (
                <p className="empty-panel-text">No members yet.</p>
              ) : (
                roomMembers.map((member) => (
                  <div className="room-member-row" key={member.uid}>
                    <div className="room-member-avatar">
                      {member.photoURL ? (
                        <img src={member.photoURL} alt={member.username} />
                      ) : (
                        getInitial(member.username || member.email)
                      )}
                    </div>

                    <div className="room-member-info">
                      <strong>{member.username}</strong>
                      <span>{member.email || "No email"}</span>
                    </div>

                    <div className="room-member-actions">
                      {member.uid === selectedRoom?.createdBy && (
                        <span className="owner-badge">Owner</span>
                      )}

                      {member.uid !== selectedRoom?.createdBy && member.uid !== user.uid && (
                        <button
                          type="button"
                          className="remove-member-button"
                          onClick={() => handleRemoveMemberFromRoom(member.uid)}
                          title="Remove member"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <form className="add-member-form" onSubmit={handleAddMemberToRoom}>
              <h3>Add member</h3>

              <input
                type="email"
                placeholder="Enter user's email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />

              <button type="submit">Add to chatroom</button>
            </form>
          </div>
        </div>
      )}

      <aside className={`side-menu ${isMenuOpen ? "open" : ""}`}>
        <div className="side-menu-profile">
          <div className="profile-avatar">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" />
            ) : (
              getInitial(userProfile?.username || user.email)
            )}
          </div>

          <div>
            <h2>{userProfile?.username || user.displayName || "User"}</h2>
            <p>{userProfile?.email || user.email}</p>
          </div>
        </div>

        <button
          className="menu-item"
          onClick={handleOpenProfile}
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

            {blockedUsersForPanel.length === 0 ? (
              <p className="empty-panel-text">No blocked users.</p>
            ) : (
              blockedUsersForPanel.map((blocked) => (
                <div className="blocked-user-row" key={blocked.uid}>
                  <span>
                    {blocked.username}
                    {blocked.email && <small>{blocked.email}</small>}
                  </span>

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

          <div className="search-box">
            <input
              type="text"
              placeholder="Search"
              value={roomSearchText}
              onChange={(e) => setRoomSearchText(e.target.value)}
            />

            {roomSearchText && (
              <button
                type="button"
                className="room-search-clear-button"
                onClick={() => setRoomSearchText("")}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

        </div>

        <div className="room-list">
          {filteredRooms.length === 0 ? (
            <p className="empty-room-search">No groups found.</p>
          ) : (
            filteredRooms.map((room) => (
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
                  </div>

                  <p>
                    {room.id === selectedRoomId
                      ? lastMessageText
                      : room.description}
                  </p>
                </div>
              </button>
            ))
          )}
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
            {isMessageSearchOpen ? (
              <div className="message-search-bar">
                <input
                  type="text"
                  placeholder="Search messages"
                  value={messageSearchText}
                  autoFocus
                  onChange={handleMessageSearchChange}
                />

                <span className="message-search-count">
                  {messageSearchText
                    ? `${messageSearchResults.length > 0 ? activeSearchIndex + 1 : 0}/${
                        messageSearchResults.length
                      }`
                    : "0/0"}
                </span>

                <button
                  type="button"
                  className="message-search-button"
                  onClick={handlePrevSearchResult}
                  disabled={messageSearchResults.length === 0}
                  title="Previous result"
                >
                  ↑
                </button>

                <button
                  type="button"
                  className="message-search-button"
                  onClick={handleNextSearchResult}
                  disabled={messageSearchResults.length === 0}
                  title="Next result"
                >
                  ↓
                </button>

                <button
                  type="button"
                  className="message-search-button"
                  onClick={handleCloseMessageSearch}
                  title="Close search"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                className="icon-button"
                type="button"
                onClick={handleOpenMessageSearch}
                title="Search messages"
              >
                ⌕
              </button>
            )}

            <button
              className="icon-button"
              type="button"
              onClick={() => setIsRoomInfoOpen(true)}
            >
              ⋮
            </button>
          </div>
        </header>

        <div className="pinned-message">
          <div className="pinned-line" />
          <div>
            <strong>Pinned message</strong>
            <p>Welcome to {selectedRoom?.name || "this room"}</p>
          </div>
        </div>

        <section className="message-list" ref={messageListRef}>
          {visibleMessages.length === 0 ? (
            <p className="empty-message">No messages yet. Start the conversation!</p>
          ) : (
            visibleMessages.map((msg) => (
              <div
                  ref={(element) => {
                    if (element) {
                      messageRefs.current[msg.id] = element;
                    }
                  }}
                  className={`message-row ${
                    msg.uid === user.uid && msg.type !== "bot"
                      ? "my-message-row sent-message-3d"
                      : "received-message-3d"
                  } ${
                    messageSearchResults.some((result) => result.id === msg.id)
                      ? "search-matched-message-row"
                      : ""
                  } ${
                    activeSearchMessageId === msg.id ? "active-search-message-row" : ""
                  }`}
                  key={msg.id}
                >
                <div className="message-avatar">
                  {msg.type === "bot" || msg.uid === "chatgpt-bot" || msg.uid === "gemini-bot" ? (
                    "AI"
                  ) : userProfiles[msg.uid]?.photoURL ? (
                    <img
                      src={userProfiles[msg.uid].photoURL}
                      alt={userProfiles[msg.uid]?.username || msg.username || "User"}
                    />
                  ) : (
                    getInitial(userProfiles[msg.uid]?.username || msg.username)
                  )}
                </div>

                <div
                  className={`message-card ${
                    msg.uid === user.uid && msg.type !== "bot" ? "my-message" : ""
                  }`}
                >
                  <div className="message-top">
                    <span className="message-user">
                      {msg.type === "bot" ? "Gemini Bot" : userProfiles[msg.uid]?.username || msg.username}
                    </span>

                    <div className="message-actions">
                      {msg.type !== "system" && (
                        <div className="emoji-action-wrapper">
                          <button
                            className="mini-action-button emoji-open-button"
                            type="button"
                            onClick={() =>
                              setOpenEmojiMessageId(
                                openEmojiMessageId === msg.id ? null : msg.id
                              )
                            }
                          >
                            ☺
                          </button>

                          {openEmojiMessageId === msg.id && (
                            <div
                              className={`emoji-picker-floating ${
                                msg.uid === user.uid && msg.type !== "bot"
                                  ? "emoji-picker-right"
                                  : "emoji-picker-left"
                              }`}
                            >
                              {emojiGroups.map((group) => (
                                <div className="emoji-group" key={group.title}>
                                  <p className="emoji-group-title">{group.title}</p>

                                  <div className="emoji-group-list">
                                    {group.emojis.map((emoji) => (
                                      <button
                                        key={`${group.title}-${emoji}`}
                                        type="button"
                                        className={`emoji-picker-button ${
                                          msg.reactions?.[emoji]?.[user.uid] ? "active" : ""
                                        }`}
                                        onClick={() => handleToggleReaction(msg, emoji)}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      

                      {msg.uid !== user.uid &&
                        msg.type !== "bot" &&
                        msg.uid !== "chatgpt-bot" &&
                        msg.uid !== "gemini-bot" && (
                          <button
                            className="mini-action-button"
                            onClick={() => handleBlockUser(msg)}
                          >
                            Block
                          </button>
                      )}

                      {msg.uid === user.uid && msg.type !== "system" && msg.type !== "bot" && (
                        <>
                          {msg.type !== "image" && (
                            <button
                              className="mini-action-button"
                              onClick={() => handleStartEditMessage(msg)}
                            >
                              Edit
                            </button>
                          )}

                          <button
                            className="mini-action-button"
                            onClick={() => handleDeleteMessage(msg)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingMessageId === msg.id ? (
                    <form
                      className="edit-message-form"
                      onSubmit={(e) => handleSaveEditMessage(e, msg)}
                    >
                      <input
                        className="edit-message-input"
                        type="text"
                        value={editingText}
                        autoFocus
                        onChange={(e) => setEditingText(e.target.value)}
                      />

                      <div className="edit-message-actions">
                        <button type="submit" className="mini-action-button">
                          Save
                        </button>

                        <button
                          type="button"
                          className="mini-action-button"
                          onClick={handleCancelEditMessage}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : msg.type === "image" ? (
                    <img
                      className="message-image"
                      src={msg.imageURL}
                      alt="Sent"
                    />
                  ) : msg.type === "system" ? (
                    <p className="system-message-text">
                      {msg.text}
                    </p>
                  ) : looksLikeCode(msg.text) ? (
                    <pre className="message-code">
                      <code>{msg.text}</code>
                      {msg.edited && <span className="edited-label"> edited</span>}
                    </pre>
                  ) : (
                    <p className="message-text">
                      {msg.text}
                      {msg.edited && <span className="edited-label"> edited</span>}
                    </p>
                  )}

                  {getReactionList(msg).length > 0 && (
                    <div className="message-reactions">
                      {getReactionList(msg).map((reaction) => (
                        <button
                          key={reaction.emoji}
                          type="button"
                          className={`reaction-chip ${
                            reaction.reactedByMe ? "my-reaction" : ""
                          }`}
                          onClick={() => handleToggleReaction(msg, reaction.emoji)}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isTwoPersonBlockedRoom && (
            <div className="blocked-chat-warning">
              You can no longer chat with this user.
            </div>
          )}

          <div ref={messageEndRef} />

        </section>

        <form className="message-form" onSubmit={handleSendMessage}>
          <button
            className="attach-button"
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isTwoPersonBlockedRoom}
          >
            📎
          </button>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="image-file-input"
            onChange={handleSendImageMessage}
          />

          <textarea
            placeholder={
              isTwoPersonBlockedRoom
                ? "You can no longer chat with this user."
                : `Write a message to ${selectedRoom?.name || "this room"}...`
            }
            value={message}
            disabled={isTwoPersonBlockedRoom}
            rows={1}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form.requestSubmit();
              }
            }}
          />

          <button
            type="submit"
            className="send-button"
            disabled={isTwoPersonBlockedRoom}
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;