# Apex Estimate // AI-Powered Remodel Job Management & Quoting

Apex Estimate is a professional, high-precision quoting and job tracking web application designed specifically for remodeling contractors. It features a squared, high-contrast, blueprint-inspired architectural theme with dark/light options, local-first browser persistence, and full integration with the **OpenRouter API** for natural language voice commands.

Equipped with an **AI Calculator Tool**, it resolves mathematical formulas client-side to ensure 100% accurate estimations without LLM calculation hallucinations.

---

## Key Features

- **AI Voice Chat Room**: Speak or type actions (e.g., *"Add client John Doe at 123 Pine St"*, *"Change project status to Scheduled"*). Integrates browser-native SpeechRecognition (voice transcription) and SpeechSynthesis (TTS vocal response) to audibly confirm mutations.
- **Top Bar AI Command Line**: A persistent command center on the header for quick, non-disruptive natural language operations.
- **AI Calculator Engine**: Enables the AI to write raw formulas as strings (e.g. `"quantity": "12 * 14 * 1.15"`, `"laborHours": "(150 / 50) * 1.5"`). The application evaluates these client-side to calculate exact values securely.
- **Visual Kanban Job Pipeline**: Drag-and-drop or click-to-move stages: `Lead` ➔ `Quoting` ➔ `Scheduled` ➔ `In Progress` ➔ `Completed/Invoiced`.
- **Predefined Remodeling Templates**: Pick from typical remodel tasks (demolition, wood framing, electrical rough-ins, porcelain tile laying, etc.) to build room-by-room quotes in seconds.
- **Change Orders Ledger**: Track scope adjustments separately with approval status flags (Pending/Approved/Rejected). Approved change orders dynamically recalculate the total contract value.
- **Site Progress Gallery**: Upload progress pictures from site inspections using drag-and-drop/file loaders (saved as local base64 Data URLs).
- **Client Directory**: Contact catalog with real-time search, editable customer cards, and complete project histories.
- **Quick-Access Sidebar Calculator**: Collapsible pocket calculator with clipboard copy capability for quick manual math.
- **Client Proposal Print Mode**: Clean, printable proposal layout that dynamically conceals internal contractor margins, markups, and hours—presenting a clean final proposal to the homeowner.
- **Data Backup & Import**: Export/Import local databases as JSON files for migrations or manual backups.

---

## Tech Stack & Architecture

- **Frontend**: React 19 (via Vite)
- **Styling**: Vanilla CSS (High-Contrast Slate and Terracotta Architectural Theme)
- **Icons**: Lucide React
- **Audio Interfaces**: HTML5 Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)
- **LLM Aggregator**: OpenRouter API
- **Persistence**: local-first `localStorage`

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
