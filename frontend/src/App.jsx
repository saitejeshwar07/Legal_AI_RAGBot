import { useState, useEffect, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./index.css";

export default function App() {
const [query, setQuery] = useState("");
const [messages, setMessages] = useState([]);
const [loading, setLoading] = useState(false);

const [chatHistory, setChatHistory] = useState([]);
const [currentChatId, setCurrentChatId] = useState(null);

const chatEndRef = useRef(null);

useEffect(() => {
const savedChats = localStorage.getItem("nyay_chats");


if (savedChats) {
  setChatHistory(JSON.parse(savedChats));
}


}, []);

useEffect(() => {
localStorage.setItem(
"nyay_chats",
JSON.stringify(chatHistory)
);
}, [chatHistory]);

useEffect(() => {
chatEndRef.current?.scrollIntoView({
behavior: "smooth",
});
}, [messages, loading]);

const newChat = () => {
setMessages([]);
setCurrentChatId(null);
};

const loadChat = (chat) => {
setMessages(chat.messages);
setCurrentChatId(chat.id);
};

const askQuestion = async () => {
if (!query.trim()) return;


const currentQuery = query;

const updatedMessages = [
  ...messages,
  {
    role: "user",
    content: currentQuery,
  },
];

setMessages(updatedMessages);
setQuery("");
setLoading(true);

try {
  const res = await axios.post(
    "http://127.0.0.1:8000/query",
    {
      query: currentQuery,
    }
  );

  const finalMessages = [
    ...updatedMessages,
    {
      role: "assistant",
      content:
        res.data.answer ||
        "No answer received.",
      sources:
        res.data.sources || [],
    },
  ];

  setMessages(finalMessages);

  const chatObj = {
    id:
      currentChatId ||
      Date.now().toString(),

    title:
      currentQuery.length > 40
        ? currentQuery.substring(0, 40) +
          "..."
        : currentQuery,

    messages: finalMessages,
  };

  setCurrentChatId(chatObj.id);

  setChatHistory((prev) => {
    const filtered = prev.filter(
      (c) => c.id !== chatObj.id
    );

    return [chatObj, ...filtered];
  });
} catch (error) {
  console.error(error);

  setMessages((prev) => [
    ...prev,
    {
      role: "assistant",
      content:
        "❌ Unable to connect to backend.",
    },
  ]);
}

setLoading(false);


};

const handleKeyDown = (e) => {
if (
e.key === "Enter" &&
!e.shiftKey
) {
e.preventDefault();
askQuestion();
}
};

return ( <div className="app-layout">


  <div className="sidebar">
    <h2>⚖️JusticeGPT</h2>

    <button
      className="new-chat-btn"
      onClick={newChat}
    >
      + New Chat
    </button>

    {chatHistory.map((chat) => (
      <div
        key={chat.id}
        className="history-item"
        onClick={() =>
          loadChat(chat)
        }
      >
        {chat.title}
      </div>
    ))}
  </div>

  <div className="main-chat">

    <div className="chat-header">
      <h1>⚖️JusticeGPT</h1>
    </div>

    <div className="chat-box">

      {messages.length === 0 && (
        <div
          style={{
            textAlign: "center",
            marginTop: "120px",
            opacity: 0.8,
          }}
        >
          <h2>
            Welcome to JusticeGPT
          </h2>

          <p>
            Ask questions about
            Indian laws,
            judgments,
            maintenance,
            FIRs, bail and
            legal procedures.
          </p>
        </div>
      )}

      {messages.map(
        (msg, index) => (
          <div
            key={index}
            className={
              msg.role === "user"
                ? "user-row"
                : "ai-row"
            }
          >
            {msg.role ===
              "assistant" && (
              <div className="avatar">
                ⚖️
              </div>
            )}

            <div
              className={
                msg.role ===
                "user"
                  ? "user-msg"
                  : "ai-msg"
              }
            >
              <ReactMarkdown>
                {msg.content}
              </ReactMarkdown>

              {msg.sources &&
                msg.sources
                  .length >
                  0 && (
                  <div className="sources">
                    <b>
                      📚 Sources
                    </b>

                    {msg.sources.map(
                      (
                        source,
                        idx
                      ) => (
                        <a
                          key={
                            idx
                          }
                          href={
                            source.link
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-item"
                        >
                          📄{" "}
                          {source.title ||
                            source.file}
                        </a>
                      )
                    )}
                  </div>
                )}
            </div>

            {msg.role ===
              "user" && (
              <div className="avatar">
                👤
              </div>
            )}
          </div>
        )
      )}

      {loading && (
        <div className="ai-row">
          <div className="avatar">
            ⚖️
          </div>

          <div className="ai-msg">
            <span className="typing">
              JusticeGPT is
              thinking...
            </span>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>

    <div className="input-box">
      <textarea
        value={query}
        onChange={(e) =>
          setQuery(
            e.target.value
          )
        }
        onKeyDown={
          handleKeyDown
        }
        placeholder="Ask any legal question..."
      />

      <button
        className="send-btn"
        onClick={
          askQuestion
        }
      >
        Send
      </button>
    </div>

  </div>
</div>


);
}
