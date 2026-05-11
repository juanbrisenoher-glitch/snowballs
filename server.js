<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Medicare Assistant AI</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .chat-container {
            width: 100%;
            max-width: 800px;
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 80vh;
        }
        .header {
            background: #2d3748;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 1.5rem;
            margin-bottom: 5px;
        }
        .header p {
            font-size: 0.85rem;
            opacity: 0.8;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background: #f7fafc;
        }
        .message {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 18px;
            line-height: 1.4;
            word-wrap: break-word;
        }
        .user {
            align-self: flex-end;
            background: #667eea;
            color: white;
            border-bottom-right-radius: 4px;
        }
        .ai {
            align-self: flex-start;
            background: #e2e8f0;
            color: #1a202c;
            border-bottom-left-radius: 4px;
        }
        .input-area {
            display: flex;
            padding: 16px;
            background: white;
            border-top: 1px solid #e2e8f0;
            gap: 12px;
        }
        input {
            flex: 1;
            padding: 12px;
            border: 1px solid #cbd5e0;
            border-radius: 40px;
            font-size: 1rem;
            outline: none;
            transition: 0.2s;
        }
        input:focus {
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102,126,234,0.2);
        }
        button {
            background: #667eea;
            color: white;
            border: none;
            padding: 0 24px;
            border-radius: 40px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
        }
        button:hover {
            background: #5a67d8;
        }
        button:disabled {
            background: #a0aec0;
            cursor: not-allowed;
        }
        .typing {
            align-self: flex-start;
            background: #e2e8f0;
            padding: 12px 16px;
            border-radius: 18px;
            font-style: italic;
            color: #4a5568;
        }
        .error {
            background: #fed7d7;
            color: #c53030;
            text-align: center;
            padding: 8px;
            border-radius: 12px;
            margin-top: 8px;
        }
        @media (max-width: 600px) {
            .message {
                max-width: 90%;
            }
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="header">
            <h1>🧠 Medicare Assistant</h1>
            <p>Ask anything about Medicare benefits, eligibility, enrollment, plans, and more</p>
        </div>
        <div class="messages" id="messages">
            <div class="message ai">
                Hello! I'm your Medicare AI assistant. Ask me about Part A, Part B, Part D, Medicare Advantage, Medigap, enrollment periods, costs, and more. I'll do my best to help!
            </div>
        </div>
        <div class="input-area">
            <input type="text" id="userInput" placeholder="e.g., What does Medicare Part B cover?" autocomplete="off">
            <button id="sendBtn">Send</button>
        </div>
    </div>

    <script>
        const messagesDiv = document.getElementById('messages');
        const userInput = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendBtn');

        function addMessage(content, isUser) {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', isUser ? 'user' : 'ai');
            messageDiv.textContent = content;
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function showTyping() {
            const typingDiv = document.createElement('div');
            typingDiv.classList.add('typing');
            typingDiv.id = 'typingIndicator';
            typingDiv.textContent = 'Medicare AI is thinking...';
            messagesDiv.appendChild(typingDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function hideTyping() {
            const typingDiv = document.getElementById('typingIndicator');
            if (typingDiv) typingDiv.remove();
        }

        async function sendMessage() {
            const message = userInput.value.trim();
            if (!message) return;

            // Disable input while sending
            sendBtn.disabled = true;
            userInput.disabled = true;

            // Show user message
            addMessage(message, true);
            userInput.value = '';

            // Show typing indicator
            showTyping();

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message }),
                });

                const data = await response.json();

                hideTyping();

                if (response.ok) {
                    addMessage(data.reply, false);
                } else {
                    addMessage('⚠️ Error: ' + (data.error || 'Something went wrong. Please try again.'), false);
                }
            } catch (error) {
                hideTyping();
                addMessage('⚠️ Network error. Please check your connection and try again.', false);
            } finally {
                sendBtn.disabled = false;
                userInput.disabled = false;
                userInput.focus();
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>
