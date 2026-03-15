# GuessMyMess.io 🎨🎮

**GuessMyMess.io** is a high-polish, real-time multiplayer drawing and guessing game built from scratch. Inspired by the classic Pictionary experience, it features a custom-built drawing engine, dynamic avatar customization, and full mobile support.

![GuessMyMess Landing Page](client/img/landing_screenshot.png) *(Note: Add your screenshot here once hosted!)*

## 🚀 Key Features

- **Real-Time Multiplayer**: Built with Socket.io for instantaneous drawing and chat synchronization across all players.
- **Custom Drawing Engine**:
  - Pen, Eraser, and Flood-Fill (Bucket) tools.
  - Variable brush sizes with live cursor preview.
  - 18-color curated palette.
  - Undo and Clear functions.
- **Avatar Customizer**: Over **billions of combinations** with customizable colors, eyes, mouths, and accessories.
- **Interactive Gameplay**:
  - **Reaction System**: Send floating 👍 or 👎 emojis while others are drawing.
  - **Smart Hints**: Word hints gradually reveal themselves as the timer runs down.
  - **Dynamic Podium**: A visual results screen celebrating the top scorers.
- **Full Mobile Support**:
  - Responsive layout with collapsible side panels.
  - Touch-optimized drawing engine (`touch-action: none` to prevent scroll-jitter).
  - Horizontal swipeable toolbar for small screens.
- **Procedural Sound Effects**: High-quality audio feedback generated via the Web Audio API without using large assets.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **Communication**: Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Graphics**: HTML5 Canvas API
- **Audio**: Web Audio API

## 🚦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Version 18 or higher)
- npm (installed automatically with Node.js)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/GuessMyMess.git
   ```
2. Navigate to the project folder:
   ```bash
   cd GuessMyMess
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser and go to `http://localhost:3000`.

## 🌍 Playing with Friends
To play with long-distance friends while running locally, you can use **ngrok**:
```bash
ngrok http 3000
```
Then send the generated `https://...` link to your friends!

## 📜 License
This project is open-source and available under the MIT License.

## 👨‍💻 Created by
**Gaurav Agrawal**
"Every great sketch starts with a single messy line."
