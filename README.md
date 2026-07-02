# Apex Estimate // AI-Powered Remodel Job Management & Quoting

Apex Estimate is a professional, high-precision quoting and job tracking web application designed specifically for remodeling contractors. It features a squared, high-contrast, blueprint-inspired architectural theme with dark/light options, local-first browser persistence, and full integration with the **OpenRouter API** for natural language voice commands.

Equipped with an **AI Calculator Tool**, it resolves mathematical formulas client-side to ensure 100% accurate estimations without LLM calculation hallucinations.

---

## Key Features

- **AI Voice Chat Room**: Speak or type actions (e.g., *"Add client John Doe at 123 Pine St"*, *"Change project status to Scheduled"*). Integrates browser-native SpeechRecognition (voice transcription) and SpeechSynthesis (TTS vocal response) to audibly confirm mutations.
- **Top Bar AI Command Line**: A persistent command center on the header for quick, non-disruptive natural language operations.
- **AI Calculator Engine**: Enables the AI to write raw formulas as strings (e.g. `"quantity": "12 * 14 * 1.15"`, `"laborHours": "(150 / 50) * 1.5"`). The application evaluates these client-side to calculate exact values securely.
- **Custom Theme Engine**: Built-in selectors for 5 design themes:
  - **Dark**: The high-contrast slate default theme.
  - **Light**: Crisp high-visibility styling.
  - **Ocean**: Relaxing deep blues, cyans, and aquas.
  - **Forest**: Earthy greens, olives, and warm browns.
  - **Midnight**: Violet background with high-contrast neon magenta accents.
- **Parametric UI Controls**: Live sliders in settings to dynamically scale spacing density (0.75x to 1.25x), text scale (0.85x to 1.15x), and border radius (0px sharp to 12px rounded).
- **Synthetic UI Sound Engine**: Web Audio API synthesizer generating click, success, and warning audio cues on the fly (requires zero external asset files). Features three customizable sound packs: Modern Crisp, Retro Mechanical, and Soft Bubble.
- **Direct URL Crawling**: Simply paste a URL in search prompts, and the engine automatically crawls, extracts, and parses the page text into the AI context for research.
- **Self-Healing LLM Routing**: Automatically intercepts OpenRouter model 404/400 errors (such as outdated or deleted model selections) and seamlessly falls back to a free, highly reliable model (`google/gemini-2.0-flash-lite:free`) to prevent chat interruptions.
- **Visual Kanban Job Pipeline**: Drag-and-drop or click-to-move stages: `Lead` ➔ `Quoting` ➔ `Scheduled` ➔ `In Progress` ➔ `Completed/Invoiced`.
- **Predefined Remodeling Templates**: Pick from typical remodel tasks to build room-by-room quotes in seconds.
- **Change Orders Ledger**: Track scope adjustments separately with approval status flags. Approved change orders dynamically recalculate the total contract value.
- **Site Progress Gallery**: Upload progress pictures from site inspections using drag-and-drop/file loaders (saved as local base64 Data URLs).
- **Client Directory**: Contact catalog with real-time search, editable customer cards, and complete project histories.
- **Quick-Access Sidebar Calculator**: Collapsible pocket calculator with clipboard copy capability for quick manual math.
- **Client Proposal Print Mode**: Clean, printable proposal layout that dynamically conceals internal contractor margins, markups, and hours—presenting a clean final proposal to the homeowner.
- **Data Backup & Import**: Export/Import local databases as JSON files for migrations or manual backups.

---

## Tech Stack & Architecture

- **Frontend**: React 19 (via Vite)
- **Styling**: Vanilla CSS with full CSS Custom Property tokens for live customization and themes
- **Icons**: Lucide React
- **Audio Interfaces**: HTML5 Web Speech API & Web Audio API (Synthesized UI audio feedback)
- **LLM Aggregator**: OpenRouter API
- **Persistence**: local-first `localStorage` + shared SQLite backend database


---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)
- OpenRouter API Key (obtained from [openrouter.ai](https://openrouter.ai/))

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/seed0001/quote-ai.git
   cd quote-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open **[http://localhost:5173/](http://localhost:5173/)** in your web browser.

5. Click **System Settings** in the left sidebar, paste your **OpenRouter API Key**, choose your preferred model, and click **Save Configuration**.

---

## Development & Build

To compile a optimized production bundle:
```bash
npm run build
```

The output will be placed in the `dist/` directory, ready to be served statically on any host.
