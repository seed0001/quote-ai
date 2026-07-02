# QuoteFlow // AI-Powered Project Workspace & Quoting Engine

QuoteFlow is an offline-first, local-first, flexible quoting, task tracking, and AI agent runtime built for **any** line of business. By blending a visual kanban workflow with a powerful, dual-pass NLP engine, QuoteFlow allows users to manage projects, design detailed cost estimates, track change orders, write SOPs, and even hire background AI agents to complete development tasks—all through a single unified interface.

Designed to be highly customizable, QuoteFlow features a parametric design system with real-time UI scaling, Web Audio API sound synthesis, and supports both cloud-hosted **OpenRouter API** models and local, offline **Ollama** LLMs to ensure complete privacy of your business data.

---

## Key Features

### 🤖 Collaborative AI Engine & Command Line
* **Dual-Pass AI Chat Room**: Speak or type requests (e.g., *"Create client John Doe"*, *"Add a $150 framing item to phase 2"*). Features browser-native transcription (SpeechRecognition) and text-to-speech (SpeechSynthesis) response options.
* **Header AI Command Bar**: A persistent top-bar console to run quick natural-language operations from any view without interrupting your workflow.
* **Direct URL Crawling**: Simply paste a URL in a chat query; QuoteFlow crawls, cleans, and feeds the webpage's text content directly into the AI's reasoning context.
* **Self-Healing LLM Fallback**: If OpenRouter rejects a query due to an outdated, dead, or rate-limited model selection, the system automatically redirects settings to the active free tier (`google/gemini-2.0-flash-lite:free`) and retries the call seamlessly without throwing errors.

### 👥 Subagents & Agent Workspace
* **Parallel Subagents**: Spawn background AI agents (`SPAWN_SUBAGENT`) with dedicated roles (e.g., "Code Researcher", "SOP Analyst", "Developer") to run parallel analysis, crawl documentation, or generate code.
* **Dedicated Workspace**: Track active subagent logs, active terminal tasks, and spawned processes in real-time.

### 📝 SOP Knowledge Base & Address Book
* **Standard Operating Procedures (SOPs)**: A built-in Knowledge Base for writing, storing, and referencing business procedures. The AI automatically consults your SOP articles before executing complex workflows.
* **Directory Separation**: Maintain a clean division between **Clients** (customers with active project pipelines) and **Contacts** (general address book for associates, friends, vendors, and associates).

### 📐 Precision Quoting & AI Calculator
* **AI Calculator Engine**: The AI writes formulas as raw strings (e.g. `"quantity": "12 * 14 * 1.15"`, `"laborHours": "(150 / 50) * 1.5"`). QuoteFlow evaluates these formulas client-side, eliminating AI math hallucinations and ensuring exact totals.
* **Change Order Ledger**: Log adjustments to active projects. Approved change orders automatically recalculate contract totals.
* **Proposal Print Mode**: Generate clean, print-ready proposals. Dynamic toggles hide internal contractor markups, material costs, and labor hours, showing only the polished, professional presentation to clients.
* **PDF Export**: Generate and download professional PDFs of your project quotes and scope summaries with one click.

### 🎨 Live Theme Builder & Synthesized Sound
* **Custom Theme Presets**: Choose between five curated UI themes:
  - **Dark**: High-contrast blue-slate default theme.
  - **Light**: High-contrast, clean light-mode layout.
  - **Ocean**: Calming deep blues, cyans, and aquas.
  - **Forest**: Earthy greens, olives, and warm browns.
  - **Midnight**: Neon magenta accents on a sleek deep violet canvas.
* **Parametric Scale Controls**: Adjust layout density (0.75x to 1.25x), text scale (0.85x to 1.15x), and component corner border-radius (0px sharp to 12px rounded) in real-time.
* **Synthesized Audio Engine**: A built-in Web Audio API synthesizer generates retro mechanical clicks, soft bubbles, or modern crisp chimes on the fly—requiring zero external audio asset loads.

---

## Tech Stack & Architecture

* **Frontend**: React 19, Lucide Icons, Vite
* **Styling**: Vanilla CSS utilizing full CSS Custom Property tokens for live customization
* **Audio**: HTML5 Web Speech API (speech-to-text / TTS) & Web Audio API (synthesized sound effects)
* **LLM Aggregators**: OpenRouter API (cloud models) + Ollama API (offline local models)
* **Persistence**: Local-first `localStorage` + server-side SQLite configuration migration

---

## Getting Started

### Prerequisites
* Node.js (v18 or higher)
* npm (v9 or higher)
* (Optional) OpenRouter API Key (from [openrouter.ai](https://openrouter.ai/))
* (Optional) Ollama running locally (from [ollama.com](https://ollama.com/))

### Quick Start
1. Clone this repository:
   ```bash
   git clone https://github.com/seed0001/quote-ai.git
   cd quote-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch QuoteFlow:
   Double-click the **`START_QUOTE_AI.bat`** file in the root folder, or run:
   ```bash
   npm run dev -- --host 127.0.0.1
   ```
   *This will launch the Vite development server and automatically open the application at **http://127.0.0.1:5173/***

4. (Optional) Start Cloudflare Tunnel:
   If you want to expose your QuoteFlow workspace securely to local devices or mobile testing, double-click **`START_CLOUDFLARE_TUNNEL.bat`**.

---

## Configuration & Model Setup

1. Open QuoteFlow in your browser and click **System Settings** in the left sidebar.
2. **Cloud Models**: Enter your OpenRouter API Key. The dropdowns will fetch available models and display clear **`🎁 [FREE]`** and **`💸 [PAID]`** badges.
3. **Local Models**: Start your local Ollama app. In QuoteFlow settings, select the **Ollama** option to toggle model selection to local instances (`llama3`, `mistral`, `gemma`, etc.), allowing you to run 100% offline.
4. Adjust volume, custom theme settings, scale multipliers, and click **Save Configuration**.
