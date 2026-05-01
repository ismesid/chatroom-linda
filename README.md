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

### 1. 帳號註冊、登入與 ALL 初始聊天室

使用者一開始會看到登入頁。若還沒有帳號，可以點 `Register here` 切換到註冊模式，輸入 email/password 後按 `Register`；也可以直接點 `Continue with Google` 使用 Google 帳號登入。

![註冊與登入入口](readme-assets/image-01.png)
![Google 登入選擇帳號](readme-assets/image-02.png)

註冊或登入成功後，系統會自動把使用者加入 `ALL` 初始聊天室。`ALL` 裡面包含所有註冊過的帳號，第一次加入時 `Gemini Bot` 也會自動送出 welcome message。

![登入後自動進入 ALL 聊天室](readme-assets/image-03.png)

如果在較小的螢幕登入，側邊 room list 可能會覆蓋聊天室內容，雙擊 `ALL` 群組名稱即可收合列表並看到 `ALL` 訊息。

![小畫面雙擊 ALL 進入聊天室](readme-assets/image-04.png)

實作邏輯：

- Email/password 註冊使用 `createUserWithEmailAndPassword`，登入使用 `signInWithEmailAndPassword`。
- Google 登入使用 `GoogleAuthProvider` 與 `signInWithPopup`。
- 登入後呼叫 `ensureDefaultRoomForUser()`，建立或更新 `users/{uid}`、`publicProfiles/{uid}`、`rooms/main/members/{uid}` 與 `userRooms/{uid}/main`。
- `botWelcomedUsers/{uid}/main` 用來記錄 Gemini welcome message 是否已送過，避免每次登入都重複問好。

相關程式碼：

- Auth form handlers: [`src/App.jsx`](src/App.jsx#L708)
- Google login: [`src/App.jsx`](src/App.jsx#L744)
- Default room/profile setup: [`src/App.jsx`](src/App.jsx#L249)
- Gemini welcome message: [`src/App.jsx`](src/App.jsx#L30)

### 2. 個人檔案修改

登入後可以點左上角三條橫線開啟功能頁。

![開啟側邊功能頁](readme-assets/image-05.png)

在功能頁點 `My Profile` 進入個人資料頁。

![點選 My Profile](readme-assets/image-06.png)

個人檔案頁可以更換照片、顯示名稱、gmail、電話號碼與地址。

![個人檔案編輯頁](readme-assets/image-07.png)

更換完成後要按下方 `Save`，變更才會寫入 database。下次登出再重新登入時，看到的資料會是儲存後的版本。

![儲存個人檔案](readme-assets/image-08.png)

因為公開顯示資訊也同步更新到 `publicProfiles`，所以別人在聊天室看到的頭像也會一起改變。

![別人看到更新後的頭像](readme-assets/image-09.png)

實作邏輯：

- profile modal 使用 `profileForm` state 暫存輸入內容。
- 圖片使用 `FileReader` 轉成 base64 data URL，直接存成 `photoURL`。
- 按 `Save` 後同時寫入 `users/{uid}` 與 `publicProfiles/{uid}`。
- Google login 時會保留 database 中已儲存的自訂 `photoURL`，不會被 Google 帳號頭像覆蓋。

相關程式碼：

- Open profile modal: [`src/App.jsx`](src/App.jsx#L1558)
- Image upload handler: [`src/App.jsx`](src/App.jsx#L1581)
- Save profile: [`src/App.jsx`](src/App.jsx#L1610)
- Profile modal UI: [`src/App.jsx`](src/App.jsx#L1828)

### 3. 封鎖與解除封鎖用戶

在別人的每則訊息右上角都有 `Block`，點選後會跳出確認視窗，確認後即可封鎖該用戶。

![訊息上的 Block 按鈕](readme-assets/image-10.png)
![封鎖確認視窗](readme-assets/image-11.png)

如果與該用戶有單獨聊天室，封鎖後聊天室會顯示不能傳訊息給該用戶，訊息框也不能輸入。

![封鎖後單獨聊天室不能傳訊息](readme-assets/image-12.png)

對方也無法傳訊息給你，也看不到你之前傳的訊息。

![對方視角也無法傳訊息](readme-assets/image-13.png)

如果在多人群組中，則會隱藏所有被 blocked 用戶傳的訊息，對其他沒有封鎖關係的使用者不會有影響。

![多人群組中 Test8 視角](readme-assets/image-14.png)
![多人群組中 Linda 視角](readme-assets/image-15.png)

若要解除封鎖，可以在功能頁點 `Blocked Users`，再按該使用者旁邊的 `Unblock`。

![Blocked Users 解除封鎖](readme-assets/image-16.png)

實作邏輯：

- 封鎖時寫入 `blocks/{currentUid}/{targetUid}: true`。
- `isBlockedBetween(uidA, uidB)` 同時檢查 A 封鎖 B 與 B 封鎖 A。
- `visibleMessages` 會過濾掉封鎖關係中的訊息。
- 如果是兩人聊天室且雙方存在封鎖關係，composer 會被停用並顯示 blocked warning。

相關程式碼：

- Message filtering: [`src/App.jsx`](src/App.jsx#L541)
- Block state listener: [`src/App.jsx`](src/App.jsx#L595)
- Block user: [`src/App.jsx`](src/App.jsx#L1648)
- Unblock user: [`src/App.jsx`](src/App.jsx#L1680)

### 4. 發送、編輯、表情、回覆與刪除訊息

在底部輸入框輸入文字後按 `Send` 即可送出。送出時按鈕有 CSS 3D animation，讓使用者清楚知道訊息正在送出。

![輸入並發送訊息](readme-assets/image-17.png)
![訊息送出後顯示在聊天室](readme-assets/image-18.png)

自己送出的文字訊息會顯示 `Edit`。點下後訊息會變成可編輯狀態，修改完成按 `Save`，或按 `Cancel` 取消。

![點選 Edit 修改自己的訊息](readme-assets/image-19.png)
![編輯完成後的訊息](readme-assets/image-20.png)

每則非 system message 都可以按笑臉按鈕開啟 emoji picker。點表情可以新增 reaction，再點同一個 reaction 可以取消。

![開啟 emoji picker](readme-assets/image-21.png)
![自己對訊息按表情](readme-assets/image-22.png)
![也可以對別人的訊息按表情](readme-assets/image-23.png)

點 `Reply` 後，輸入框上方會顯示正在回覆哪一則訊息。送出後，新訊息會帶有原訊息的引用區塊。

![選擇要回覆的訊息](readme-assets/image-24.png)
![送出後顯示 reply reference](readme-assets/image-25.png)

點 reply reference 可以跳回原始訊息，原訊息會短暫高亮，讓使用者知道回覆的是哪一句。

![點 reply reference 跳回原訊息](readme-assets/image-26.png)

自己送出的訊息也可以點 `Delete`，確認後從聊天室移除。不是自己送出的訊息不會顯示刪除功能。

![刪除訊息確認](readme-assets/image-27.png)

實作邏輯：

- 文字訊息會 push 到 `roomMessages/{selectedRoomId}`，包含 `uid`、`username`、`text`、`roomId` 與 `createdAt`。
- 編輯訊息時只允許 sender 更新同一筆 message 的 `text`、`edited` 與 `editedAt`。
- 刪除訊息前檢查 `msg.uid === user.uid`，通過後才呼叫 `remove()`。
- reaction 寫到 `publicProfiles/{uid}/messageReactions/{roomId}/{messageId}/{emoji}`，再由 UI 統計每個 emoji 的使用者清單。
- emoji picker 放在 app 最外層，並依照按鈕位置計算座標，避免被長訊息或短訊息裁切。
- reply 會在新訊息中儲存 `replyTo` metadata，點擊時使用 message ref 捲動並高亮原訊息。

相關程式碼：

- Send text message: [`src/App.jsx`](src/App.jsx#L817)
- Edit message: [`src/App.jsx`](src/App.jsx#L1044)
- Delete message: [`src/App.jsx`](src/App.jsx#L1105)
- Toggle reaction: [`src/App.jsx`](src/App.jsx#L1136)
- Emoji picker positioning: [`src/App.jsx`](src/App.jsx#L1174)
- Start reply / jump to reply: [`src/App.jsx`](src/App.jsx#L1219)
- Message rendering: [`src/App.jsx`](src/App.jsx#L2262)

### 5. 圖片訊息、文字搜尋、程式碼顯示與 Gemini Bot

點輸入框左下角的 attachment button 可以選擇圖片並送出。每個使用者在同一個聊天室最多保留五張圖片，送第六張時最舊的圖片會被移除。圖片訊息一樣可以 reply、delete 與 reaction。

![傳送圖片訊息](readme-assets/image-28.png)
![圖片數量超過限制時移除最舊圖片](readme-assets/image-29.png)

點聊天室右上角放大鏡可以搜尋目前聊天室的文字訊息。輸入關鍵字後，符合的訊息會以黃框標示，也可以用上下箭頭跳到上一則或下一則結果。

![開啟聊天室文字搜尋](readme-assets/image-30.png)
![搜尋結果高亮並可上下切換](readme-assets/image-31.png)

如果送出的內容看起來像網頁程式碼或 HTML tag，聊天室會把它用 code block 顯示，避免被當成真正的 HTML 或 JavaScript 執行。

![程式碼訊息以 code block 顯示](readme-assets/image-32.png)

在 `ALL` 群組中，訊息前加上 `@bot` 就可以呼叫 `Gemini Bot`。Bot 會先顯示處理狀態，再把回答送回同一個聊天室。

![用 @bot 呼叫 Gemini Bot](readme-assets/image-33.png)
![Gemini Bot 正在回覆](readme-assets/image-34.png)
![Gemini Bot 回覆結果](readme-assets/image-35.png)

實作邏輯：

- 圖片使用 `FileReader` 轉成 base64 data URL，並以 `type: "image"` 與 `imageURL` 存入訊息。
- 圖片上傳前檢查 file type 與 file size，避免 database 被過大的圖片塞滿。
- `messageSearchResults` 從 `visibleMessages` 篩選文字訊息，`activeSearchIndex` 控制目前選到的搜尋結果。
- 搜尋結果變更時，程式會將對應 message element 捲到可見位置。
- `looksLikeCode()` 檢查 HTML-like tags 與常見 code tokens，code-like message 會用 `<pre><code>` 呈現。
- `isBotMentioned()` 判斷是否包含 `@bot`，送出時先建立 `Thinking...` bot message，再用 Gemini 回覆更新同一則訊息。

相關程式碼：

- Send image message: [`src/App.jsx`](src/App.jsx#L924)
- Message search calculation: [`src/App.jsx`](src/App.jsx#L554)
- Search controls: [`src/App.jsx`](src/App.jsx#L786)
- Code detection: [`src/App.jsx`](src/App.jsx#L1710)
- Gemini chat reply: [`src/App.jsx`](src/App.jsx#L93)
- Bot trigger in send flow: [`src/App.jsx`](src/App.jsx#L817)

### 6. 建立群組、邀請成員、移除成員與搜尋群組

要建立新群組時，先點群組列表左上角三條橫線開啟功能頁。

![開啟功能頁準備建立群組](readme-assets/image-36.png)

點 `New Group` 後輸入群組名稱，再按 `Create`。

![輸入新群組名稱](readme-assets/image-37.png)

建立完成後，聊天室會自動停留在新群組，而不是跳回 `ALL`。

![建立後自動進入新群組](readme-assets/image-38.png)

若要邀請新成員或查看成員，點群組名稱右邊的三點，會跳出 member list。

![開啟群組成員列表](readme-assets/image-39.png)

在成員列表下方輸入想邀請成員的 gmail，按 `Add to chatroom`，對方就會被加入此群組。

![輸入 gmail 邀請成員](readme-assets/image-40.png)
![成功加入成員](readme-assets/image-41.png)
![成員出現在群組列表中](readme-assets/image-42.png)

被加入的使用者也會在自己的 room list 看到此群組。

![新成員可以看到被邀請的群組](readme-assets/image-43.png)

如果要移除群組內帳號，一樣先點群組名稱右邊三點開啟 member list，再點想移除成員旁邊的紅色叉叉。

![點紅色叉叉移除成員](readme-assets/image-44.png)
![確認移除成員](readme-assets/image-45.png)
![移除流程提示](readme-assets/image-46.png)
![移除後成員列表更新](readme-assets/image-47.png)

左側 room list 上方的搜尋欄可以輸入群組名稱，只顯示目前使用者已加入且符合關鍵字的群組。

![搜尋群組結果](readme-assets/image-48.png)
![搜尋不到符合群組](readme-assets/image-49.png)

實作邏輯：

- 建立群組時使用 `push(ref(database, "rooms"))` 產生新的 room id。
- 因為 database rules 要求 room member 才能寫 room metadata，所以程式先寫 `rooms/{newRoomId}/members/{uid}: true`，再寫入 name、description、avatar、createdBy 與 `userRooms/{uid}/{newRoomId}`。
- 建立成功後用 `pendingRoomSelectionRef` 保留新 room id，room list 更新完成後自動選到新群組。
- 邀請成員時從 `publicProfiles` 用 email 找到 uid，然後同步寫入 `rooms/{roomId}/members/{newMemberUid}` 與 `userRooms/{newMemberUid}/{roomId}`。
- 移除成員時同時刪除 `rooms/{roomId}/members/{memberUid}` 與 `userRooms/{memberUid}/{roomId}`，讓成員權限與 sidebar room index 一起更新。
- 群組搜尋使用已載入的 rooms 做 client-side filter，只搜尋目前使用者有權限看到的群組。

相關程式碼：

- Create group: [`src/App.jsx`](src/App.jsx#L1354)
- Add member: [`src/App.jsx`](src/App.jsx#L1410)
- Remove member: [`src/App.jsx`](src/App.jsx#L1508)
- Room search: [`src/App.jsx`](src/App.jsx#L326)
- Room info modal UI: [`src/App.jsx`](src/App.jsx#L1918)

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
