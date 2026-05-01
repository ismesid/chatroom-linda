# Chatroom Linda

Chatroom Linda 是一個使用 `React + Vite` 與 `Firebase` 製作的即時聊天室網站。設計理念是做出接近 `Messenger` 的使用體驗：使用者可以註冊/登入、進入共同的 `ALL` 聊天室、建立私人群組、邀請成員、編輯個人資料、傳送文字與圖片、對訊息按表情符號、回覆指定訊息、封鎖使用者，也可以透過 `@bot` 呼叫 `Gemini Bot` 回覆。

整體介面採用深色、緊湊的聊天室排版，讓聊天室列表、訊息內容、訊息操作按鈕、個人資料與群組管理都能在同一個工作流程中快速使用。

## Website

- Firebase Hosting: <https://chatroom-linda.web.app>
- GitHub repository: <https://github.com/ismesid/chatroom-linda>

## Scoring Checklist

### Basic Components

| Basic components | Score | Check |
|---|---:|:---:|
| Membership Mechanism: Email Sign Up / Email Sign In | 5% | Y |
| Host Firebase page with Firebase Hosting | 5% | Y |
| Database read/write in authenticated way | 5% | Y |
| RWD: layout works on different device sizes | 5% | Y |
| Git version control | 5% | Y |
| Chatroom: private rooms, invite members, message history | 25% | Y |

### Advanced Components

| Advanced components | Score | Check |
|---|---:|:---:|
| Using framework: React | 5% | Y |
| Sign Up / In with Google | 1% | Y |
| CSS animation | 2% | Y |
| Deal with problems when sending code | 2% | Y |
| Chrome notification | 5% | N |
| User Profile: editable picture, username, email, phone, address | 10% | Y |
| Message operation: unsend, edit, search, send image | 10% | Y |

### Bonus Components

| Bonus components | Score | Check |
|---|---:|:---:|
| Chatbot with Gemini API | 2% | Y |
| Block User | 2% | Y |
| Send emoji to message | 3% | Y |
| Reply for specific message | 6% | Y |
| Send GIF from Giphy API | 3% | N |
| Send custom sticker into chatroom | 10% | N |

## Local Setup

1. 安裝專案依賴套件。

```bash
npm install
```

2. 如果需要啟用 `Gemini Bot`，在專案根目錄建立 `.env.local`，並放入 API key。

```bash
VITE_GEMINI_API_KEY=your_api_key_here
```

3. 啟動本機開發伺服器。

```bash
npm run dev
```

4. 開啟 Vite 顯示的網址，通常是：

```text
http://localhost:5173/
```

5. 建立 production build。

```bash
npm run build
```

6. 部署到 `Firebase Hosting`。

```bash
firebase deploy --only hosting
```

## Firebase Structure

本專案使用 `Firebase Authentication` 與 `Realtime Database`。主要資料節點如下：

| Path | 用途 |
|---|---|
| `users/{uid}` | 使用者私人 profile 資料，只有本人可以讀寫。 |
| `publicProfiles/{uid}` | 公開顯示用 profile，以及每個使用者自己的 message reactions。登入使用者可讀，只有本人可寫自己的資料。 |
| `blocks/{uid}/{blockedUid}` | 每個使用者自己的封鎖名單。 |
| `rooms/{roomId}` | 聊天室 metadata 與 members。只有房間成員可以讀取。 |
| `userRooms/{uid}/{roomId}` | 每個使用者擁有的聊天室索引，用來載入左側 room list。 |
| `roomMessages/{roomId}/{messageId}` | 每個聊天室的訊息資料。只有該聊天室成員可以讀寫。 |
| `botWelcomedUsers/{uid}/{roomId}` | 紀錄 `Gemini Bot` 是否已經歡迎過該使用者，避免重複送 welcome message。 |

### Realtime Database Rules 說明

這份 rules 的核心概念是「使用者只能管理自己的資料」以及「只有聊天室成員才能讀寫該聊天室」。

- `users`: 使用者只能讀寫自己的私人 profile。
- `publicProfiles`: 所有登入使用者都能讀公開 profile，但每個使用者只能寫自己的公開資料。
- `rooms`: 只有 `rooms/{roomId}/members/{auth.uid}` 為 `true` 的使用者可以讀取該 room。
- `members`: 使用者可以把自己加入房間；既有房間成員可以新增或移除成員。
- `userRooms`: 使用者只能讀自己的 room index。
- `roomMessages`: 只有 room 成員可以讀寫該 room 的訊息。
- message validation 限制文字長度最多 5000，並要求 `uid`、`username`、`text`、`roomId`、`createdAt` 等欄位。
- bot message 只允許在 `main` room 由指定 bot uid 寫入。
- `botWelcomedUsers`: 每個使用者只能寫自己的 welcome 狀態。

表情符號 reactions 另外存到 `publicProfiles/{uid}/messageReactions/...`，而不是直接改別人的 `roomMessages/{messageId}`。這樣可以避免因為別人的 message `uid` 不等於目前登入者而被 message validation 擋下。

#### Rules 設計概念

Realtime Database 的資料是直接由前端讀寫，所以 rules 不是只做「有沒有登入」的檢查，而是把每個功能需要的權限一起寫進資料路徑中。設計上主要分成幾個層次：

- Authentication first: 幾乎所有資料都要求 `auth != null`，避免未登入使用者讀取或寫入聊天室資料。
- Owner-only private data: `users/{uid}`、`userRooms/{uid}`、`botWelcomedUsers/{uid}` 都只能由本人讀寫，適合存放個人 profile、自己加入的房間索引與 bot welcome 狀態。
- Public but controlled profile: `publicProfiles` 可以被所有登入使用者讀取，因為聊天畫面需要顯示其他人的名稱與照片；但寫入仍限制為本人。
- Room membership permission: `rooms` 與 `roomMessages` 都用 `rooms/{roomId}/members/{auth.uid}` 判斷是否為成員，只有成員能讀取與寫入該聊天室內容。
- Cross-index room list: `rooms/{roomId}/members` 是聊天室角度的成員資料，`userRooms/{uid}/{roomId}` 是使用者角度的房間索引，這樣可以快速載入目前使用者有哪些 room。
- Data validation: `name`、`description`、`avatar`、`text` 等欄位都有型別與長度限制，避免前端寫入不符合格式的資料。
- Bot exception: 一般訊息只能由目前登入者本人寫入，但 `main` room 額外允許 `chatgpt-bot` 與 `gemini-bot` 寫入，讓 AI welcome message 與 bot reply 可以存在同一個訊息節點中。
- Reactions workaround: 因為 `roomMessages` 的 validation 會檢查 message `uid`，如果直接修改別人的 message 會被擋，所以 emoji reactions 存在 `publicProfiles/{uid}/messageReactions`，用「使用者自己的公開資料」記錄對各訊息的反應。

#### 完整 Realtime Database Rules

以下 rules 可貼到 Firebase Console 的 Realtime Database Rules 中使用：

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },

    "publicProfiles": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid"
      }
    },

    "blocks": {
      ".read": "auth != null",
      "$uid": {
        "$blockedUid": {
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    },

    "rooms": {
      "$roomId": {
        ".read": "auth != null && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true",

        "name": {
          ".write": "auth != null && ($roomId === 'main' || root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true)",
          ".validate": "newData.isString() && newData.val().length <= 80"
        },

        "description": {
          ".write": "auth != null && ($roomId === 'main' || root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true)",
          ".validate": "newData.isString() && newData.val().length <= 200"
        },

        "avatar": {
          ".write": "auth != null && ($roomId === 'main' || root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true)",
          ".validate": "newData.isString() && newData.val().length <= 10"
        },

        "createdBy": {
          ".write": "auth != null && !data.exists()",
          ".validate": "newData.val() === auth.uid"
        },

        "createdAt": {
          ".write": "auth != null && !data.exists()"
        },

        "members": {
          "$uid": {
            ".write": "auth != null && ((auth.uid === $uid && newData.val() === true) || root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true)",
            ".validate": "newData.val() === true || newData.val() === null"
          }
        }
      }
    },

    "userRooms": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$roomId": {
          ".write": "auth != null && ((auth.uid === $uid && newData.val() === true) || root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true)",
          ".validate": "newData.val() === true || newData.val() === null"
        }
      }
    },

    "roomMessages": {
      "$roomId": {
        ".read": "auth != null && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true",

        "$messageId": {
          ".write": "auth != null && root.child('rooms').child($roomId).child('members').child(auth.uid).val() === true",
          ".validate": "newData.hasChildren(['uid', 'username', 'text', 'roomId', 'createdAt']) && newData.child('roomId').val() === $roomId && newData.child('text').isString() && newData.child('text').val().length <= 5000 && ((newData.child('uid').val() === auth.uid) || ($roomId === 'main' && (newData.child('uid').val() === 'chatgpt-bot' || newData.child('uid').val() === 'gemini-bot')))"
        }
      }
    },

    "botWelcomedUsers": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$roomId": {
          ".write": "auth != null && auth.uid === $uid",
          ".validate": "newData.val() === true"
        }
      }
    }
  }
}
```

相關程式碼：

- Firebase 初始化：[`src/firebase.js`](src/firebase.js#L9)
- Auth state 與 profile 初始化：[`src/App.jsx`](src/App.jsx#L338)
- 預設 `ALL` room 建立：[`src/App.jsx`](src/App.jsx#L249)
- 從 `userRooms` 載入 room list：[`src/App.jsx`](src/App.jsx#L388)
- 從 `roomMessages` 載入訊息：[`src/App.jsx`](src/App.jsx#L512)

## 功能操作與實作說明

### 1. Register And Login

使用者可以點 `Register here` 切換到註冊模式，輸入 email/password 後按 `Register`。也可以直接按 `Continue with Google` 使用 Google 帳號登入。

註冊成功後，系統會自動把使用者加入 `ALL` 聊天室，並由 `Gemini Bot` 送出 welcome message。

實作邏輯：

- Email/password 註冊使用 `createUserWithEmailAndPassword`。
- Email/password 登入使用 `signInWithEmailAndPassword`。
- Google 登入使用 `GoogleAuthProvider` 與 `signInWithPopup`。
- 登入後呼叫 `ensureDefaultRoomForUser()`，建立或更新 `users/{uid}`、`publicProfiles/{uid}`、`ALL` room membership 與 `userRooms/{uid}/main`。

相關程式碼：

- Auth form handlers: [`src/App.jsx`](src/App.jsx#L708)
- Google login: [`src/App.jsx`](src/App.jsx#L744)
- Default room/profile setup: [`src/App.jsx`](src/App.jsx#L249)

![Register page](readme-assets/image-01.png)
![Google account chooser](readme-assets/image-02.png)
![ALL room after login](readme-assets/image-03.png)

### 2. Room List And Side Menu

登入後，左側會顯示目前使用者可進入的聊天室。上方搜尋框可以依照 room name 或 description 篩選聊天室。左上角 menu button 可以開啟側邊欄，裡面有 `My Profile`、`New Group`、`Blocked Users`、`Logout`。

實作邏輯：

- `userRooms/{uid}` 是使用者擁有的聊天室索引。
- 讀到 room id 後，再讀 `rooms/{roomId}` 取得 room name、description、avatar、members。
- Room search 使用 `useMemo()` 對已載入 rooms 做文字篩選。

相關程式碼：

- Room search: [`src/App.jsx`](src/App.jsx#L326)
- Load rooms from `userRooms`: [`src/App.jsx`](src/App.jsx#L388)
- Select room: [`src/App.jsx`](src/App.jsx#L773)

![Room list](readme-assets/image-04.png)
![Room list with group](readme-assets/image-05.png)
![Side menu](readme-assets/image-06.png)

### 3. User Profile

開啟 side menu 後點 `My Profile`，會出現 profile modal。使用者可以編輯並儲存：

- Profile picture
- Username
- Email
- Phone number
- Address

儲存後，聊天室訊息、member list、side menu 都會使用更新後的 username 或 profile picture。

實作邏輯：

- profile modal 使用 `profileForm` state 暫存輸入內容。
- 上傳圖片時使用 `FileReader` 轉成 base64 data URL。
- 按 `Save` 後，同步寫入 `users/{uid}` 與 `publicProfiles/{uid}`。
- Google login 時會保留 database 中已儲存的自訂 `photoURL`，不會被 Google 帳號頭像覆蓋。

相關程式碼：

- Open profile modal: [`src/App.jsx`](src/App.jsx#L1558)
- Image upload handler: [`src/App.jsx`](src/App.jsx#L1581)
- Save profile: [`src/App.jsx`](src/App.jsx#L1610)
- Profile modal UI: [`src/App.jsx`](src/App.jsx#L1801)

![Profile form empty fields](readme-assets/image-07.png)
![Profile saved with custom fields](readme-assets/image-08.png)

### 4. Send, Edit, And Delete Text Messages

在底部輸入框輸入訊息後按 `Send` 即可送出。自己送出的訊息會顯示 `Edit` 與 `Delete`，其他人的訊息不會顯示這兩個操作。

實作邏輯：

- 送出訊息時，將 message object push 到 `roomMessages/{selectedRoomId}`。
- 編輯訊息時更新同一筆 message 的 `text`、`edited`、`editedAt`。
- 刪除訊息時只允許 `msg.uid === user.uid` 的使用者刪除。
- 自己送出的 message card 有 CSS 3D animation。

相關程式碼：

- Send text message: [`src/App.jsx`](src/App.jsx#L817)
- Edit message: [`src/App.jsx`](src/App.jsx#L1044)
- Delete message: [`src/App.jsx`](src/App.jsx#L1105)
- Message rendering: [`src/App.jsx`](src/App.jsx#L2261)

![Message actions](readme-assets/image-09.png)
![Block button on another user's message](readme-assets/image-10.png)

### 5. Block And Unblock Users

在別人的訊息上點 `Block`，系統會跳出確認視窗。若是兩人聊天室，被封鎖後輸入框會顯示警告；若是在群組聊天室，雙方會互相看不到彼此訊息。若要解除封鎖，可到 side menu 的 `Blocked Users` 按 `Unblock`。

實作邏輯：

- 封鎖時寫入 `blocks/{currentUid}/{targetUid}: true`。
- `isBlockedBetween(uidA, uidB)` 同時檢查 A 封鎖 B 與 B 封鎖 A。
- `visibleMessages` 會過濾掉封鎖關係中的訊息。
- `isTwoPersonBlockedRoom` 用來判斷 1-on-1 blocked room，並停用 composer。

相關程式碼：

- Block state listener: [`src/App.jsx`](src/App.jsx#L595)
- Message filtering: [`src/App.jsx`](src/App.jsx#L541)
- Block user: [`src/App.jsx`](src/App.jsx#L1648)
- Unblock user: [`src/App.jsx`](src/App.jsx#L1680)

![Block confirmation](readme-assets/image-11.png)
![Blocked room warning](readme-assets/image-12.png)
![Blocked private room](readme-assets/image-13.png)
![Hidden blocked messages in room](readme-assets/image-14.png)
![Messages after filtering blocked user](readme-assets/image-15.png)
![Blocked users panel](readme-assets/image-16.png)

### 6. Message Search

點聊天室右上方的 search icon，輸入關鍵字後可以搜尋目前聊天室所有可見文字訊息。搜尋結果會顯示目前第幾筆，並可用上下按鈕切換。被選到的訊息會自動捲動到畫面中並高亮。

實作邏輯：

- `messageSearchResults` 只從 `visibleMessages` 中篩選文字訊息。
- `activeSearchIndex` 記錄目前選中的搜尋結果。
- `useLayoutEffect` 會在搜尋結果變更時，讓對應 message element 捲到可見位置。

相關程式碼：

- Search result calculation: [`src/App.jsx`](src/App.jsx#L552)
- Search controls: [`src/App.jsx`](src/App.jsx#L786)
- Scroll to active search result: [`src/App.jsx`](src/App.jsx#L666)

![Search message input](readme-assets/image-17.png)

### 7. Edit Flow

點自己訊息上的 `Edit`，訊息會切換成編輯輸入框。修改後按 `Save`，訊息內容會更新並顯示 edited 狀態。

實作邏輯：

- `editingMessageId` 控制目前哪一則訊息進入 edit mode。
- edit form 會替換原本的 message body。
- 儲存時更新 database 中同一筆 message node。

相關程式碼：

- Start edit: [`src/App.jsx`](src/App.jsx#L1044)
- Save edit: [`src/App.jsx`](src/App.jsx#L1064)

![Before editing](readme-assets/image-18.png)
![Editing message](readme-assets/image-19.png)
![Edited message result](readme-assets/image-20.png)

### 8. Emoji Reactions

點任一非 system message 上的 emoji button，選擇表情符號即可新增 reaction。再點同一個 reaction 可以收回。reaction chip 會顯示 emoji 與目前總數。

實作邏輯：

- emoji picker 會渲染在 app 最外層，並依照被點擊按鈕的位置計算座標，避免被長訊息或短訊息裁切。
- 每個使用者的 reaction 寫到 `publicProfiles/{uid}/messageReactions/{roomId}/{messageId}/{emoji}`。
- `getMessageReactionUsers()` 會合併舊的 message-level reactions 與新的 profile-level reactions。
- `hasReactedToMessage()` 用來判斷目前使用者是否已經點過該 emoji。

相關程式碼：

- Toggle reaction: [`src/App.jsx`](src/App.jsx#L1136)
- Picker positioning: [`src/App.jsx`](src/App.jsx#L1174)
- Reaction aggregation: [`src/App.jsx`](src/App.jsx#L1307)
- Reaction UI: [`src/App.jsx`](src/App.jsx#L2438)

![Emoji picker](readme-assets/image-21.png)
![Selected reaction chip](readme-assets/image-22.png)
![Reaction count](readme-assets/image-23.png)

### 9. Reply To A Specific Message

點訊息上的 `Reply`，輸入框上方會顯示正在回覆哪一則原始訊息。送出後，新的訊息卡片會包含 reply reference。點 reply reference 時，畫面會捲回原始訊息並高亮提示。

實作邏輯：

- `replyToMessage` 保存原始訊息的 metadata。
- 新訊息送出時會包含 `replyTo` object。
- `messageRefs` 用 message id 保存 DOM node。
- `handleJumpToReplyMessage()` 負責 scroll 與 highlight 原始訊息。

相關程式碼：

- Start reply: [`src/App.jsx`](src/App.jsx#L1219)
- Jump to original message: [`src/App.jsx`](src/App.jsx#L1243)
- Send message with reply metadata: [`src/App.jsx`](src/App.jsx#L845)
- Reply UI rendering: [`src/App.jsx`](src/App.jsx#L2369)

![Reply composer preview](readme-assets/image-24.png)
![Reply message in chat](readme-assets/image-25.png)
![Original message highlighted](readme-assets/image-26.png)

### 10. Delete / Unsend Message

點自己訊息上的 `Delete`，系統會跳出確認視窗。確認後會從 `Realtime Database` 移除該訊息。使用者不能刪除不是自己送出的訊息。

實作邏輯：

- delete handler 先檢查 `msg.uid === user.uid`。
- 通過檢查後呼叫 `remove(ref(database, path))`。
- 如果該訊息正在 edit mode，刪除後會取消 edit mode。

相關程式碼：

- Delete message: [`src/App.jsx`](src/App.jsx#L1105)

![Delete confirmation](readme-assets/image-27.png)

### 11. Send Images

點輸入框旁邊的 attachment button，選擇圖片後會送出 image message。圖片訊息也可以由發送者自己刪除。為了避免 database 過大，圖片限制 800 KB，且圖片數量超過限制時，較舊的圖片會被替換成 system message。

實作邏輯：

- 使用 `FileReader` 將圖片轉成 base64 data URL。
- image message 使用 `type: "image"` 與 `imageURL`。
- 上傳前檢查 file type 與 file size。
- 發送者可以刪除自己的 image message。

相關程式碼：

- Send image message: [`src/App.jsx`](src/App.jsx#L924)
- Image message rendering: [`src/App.jsx`](src/App.jsx#L2415)

![Image message](readme-assets/image-28.png)
![Image limit system message](readme-assets/image-29.png)

### 12. Sending Code Safely

當訊息看起來像程式碼時，例如 `<script>alert(...)</script>` 或 `<h1>example</h1>`，畫面會把它當文字顯示在 `<pre><code>` 區塊，而不是執行成 HTML 或 JavaScript。

實作邏輯：

- `looksLikeCode()` 檢查 HTML-like tags 與常見 code tokens。
- code-like message 會用 code block 顯示。
- React 預設會 escape string content，因此程式碼不會被執行。

相關程式碼：

- Code detection: [`src/App.jsx`](src/App.jsx#L1701)
- Code rendering: [`src/App.jsx`](src/App.jsx#L2426)

![Code message shown safely](readme-assets/image-30.png)
![Search and code examples](readme-assets/image-31.png)
![HTML/script text is not executed](readme-assets/image-32.png)

### 13. Gemini Chatbot

在訊息中輸入 `@bot` 就可以詢問 `Gemini Bot`。Bot 會讀取目前 room name 與近期聊天紀錄，再在同一個聊天室中回覆。

實作邏輯：

- `isBotMentioned()` 判斷訊息是否包含 `@bot`。
- `cleanBotPrompt()` 移除 `@bot` 後取得真正要問 bot 的內容。
- 送出時先建立 `Thinking...` bot message，再用 Gemini 回覆更新同一則訊息。
- 新使用者第一次加入 `ALL` 時，也會收到 Gemini welcome message。

相關程式碼：

- Gemini welcome message: [`src/App.jsx`](src/App.jsx#L30)
- Gemini chat reply: [`src/App.jsx`](src/App.jsx#L93)
- Bot trigger in send flow: [`src/App.jsx`](src/App.jsx#L871)

![Mention bot in composer](readme-assets/image-33.png)
![Bot thinking](readme-assets/image-34.png)
![Bot reply](readme-assets/image-35.png)

### 14. Create Private Groups

開啟 side menu，點 `New Group`，輸入 group name 後按 `Create`。新群組會出現在左側 room list，畫面也會停留在新建立的 group。

實作邏輯：

- 使用 `push(ref(database, "rooms"))` 產生新的 room id。
- 因為 database rules 要求「必須先是 room member 才能寫 room metadata」，所以程式先寫 `rooms/{newRoomId}/members/{uid}: true`。
- membership 建立後，再寫入 room metadata 與 `userRooms/{uid}/{newRoomId}`。
- 如果第二步失敗，會清掉第一步留下的 membership。

相關程式碼：

- Create group: [`src/App.jsx`](src/App.jsx#L1354)
- Keep newly created group selected: [`src/App.jsx`](src/App.jsx#L245)

![Open side menu](readme-assets/image-36.png)
![New group form](readme-assets/image-37.png)
![New room after creation](readme-assets/image-38.png)
![Empty new room](readme-assets/image-39.png)

### 15. Invite Members To A Group

點聊天室右上方的 room info button，輸入其他使用者的 email，再按 `Add to chatroom`。系統會從 `publicProfiles` 找到該 email 對應的 uid，並把使用者加入 group。

實作邏輯：

- 讀取 `publicProfiles` 以 email 找到目標使用者。
- 同時寫入 `rooms/{roomId}/members/{newMemberUid}` 與 `userRooms/{newMemberUid}/{roomId}`。
- 這樣 room membership 與新成員的 sidebar room index 會保持同步。

相關程式碼：

- Add member: [`src/App.jsx`](src/App.jsx#L1410)
- Room info modal UI: [`src/App.jsx`](src/App.jsx#L1918)

![Room info add member](readme-assets/image-40.png)
![Add member success](readme-assets/image-41.png)
![Member appears in room](readme-assets/image-42.png)
![New member can see room](readme-assets/image-43.png)

### 16. Rename, Remove Members, And Search Rooms

在 room info modal 中，room member 可以 rename group。畫面也會用 `Owner` badge 顯示建立者。既有成員可以移除其他成員。左側 room search 可以篩選 room name。

實作邏輯：

- Rename 會寫入 `rooms/{roomId}/name`，並同步更新 avatar initial。
- Remove member 會刪除 `rooms/{roomId}/members/{memberUid}` 與 `userRooms/{memberUid}/{roomId}`。
- Sidebar search 會依照 room name 與 description 篩選 rooms。

相關程式碼：

- Rename room: [`src/App.jsx`](src/App.jsx#L1470)
- Remove member: [`src/App.jsx`](src/App.jsx#L1508)
- Room search: [`src/App.jsx`](src/App.jsx#L326)

![Remove member button](readme-assets/image-44.png)
![Remove confirmation](readme-assets/image-45.png)
![Cannot remove owner warning](readme-assets/image-46.png)
![Room after member removed](readme-assets/image-47.png)
![Search room result](readme-assets/image-48.png)
![No room search result](readme-assets/image-49.png)

## Implementation Summary

| Feature | 實作邏輯 | 主要程式碼 |
|---|---|---|
| Auth | 使用 Firebase Auth 完成 email/password 與 Google popup login | [`src/App.jsx`](src/App.jsx#L708) |
| Profile | 分別儲存 private profile 與 public display profile | [`src/App.jsx`](src/App.jsx#L1610) |
| Room list | 先讀 `userRooms/{uid}`，再讀每個 room 的 metadata | [`src/App.jsx`](src/App.jsx#L388) |
| Chat history | 訂閱 `roomMessages/{roomId}`，並依 `createdAt` 排序 | [`src/App.jsx`](src/App.jsx#L512) |
| Send text | 將 message push 到目前選取的 room | [`src/App.jsx`](src/App.jsx#L817) |
| Send image | 將圖片轉成 data URL 後送出 image message | [`src/App.jsx`](src/App.jsx#L924) |
| Edit/delete | 只有 sender 可以 edit 或 delete 自己的 message | [`src/App.jsx`](src/App.jsx#L1044) |
| Search | 從 visible messages 篩選並捲動到 active result | [`src/App.jsx`](src/App.jsx#L552) |
| Reactions | 將 reactions 存在每個使用者自己的 public profile 底下 | [`src/App.jsx`](src/App.jsx#L1136) |
| Reply | 儲存 reply metadata，並支援 scroll/highlight 原始訊息 | [`src/App.jsx`](src/App.jsx#L1219) |
| Block | 儲存 block relationship，並在顯示訊息時過濾 | [`src/App.jsx`](src/App.jsx#L1648) |
| Groups | 建立 room、邀請成員、rename、remove members | [`src/App.jsx`](src/App.jsx#L1354) |
| Gemini bot | 偵測 `@bot`，把 prompt/history 傳給 Gemini，再更新 bot reply | [`src/App.jsx`](src/App.jsx#L871) |

## Project Files

```text
chatroom/
├── src/
│   ├── App.jsx        Main React app and feature logic
│   ├── App.css        Layout, responsive UI, animations
│   └── firebase.js    Firebase initialization
├── functions/
│   └── index.js       Optional Firebase Function for Gemini welcome messages
├── public/
├── dist/              Production build output
├── firebase.json      Firebase Hosting and Functions config
└── README.md
```
