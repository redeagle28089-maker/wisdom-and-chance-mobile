# Wisdom and Chance Mobile - TCG App

## Overview

Wisdom and Chance Mobile is a Trading Card Game (TCG) mobile application built with React Native and Expo. The app is a client for an existing backend service hosted at `https://wisdom-and-chance.replit.app`. It allows players to browse cards and commanders, build decks, play games in rooms, interact socially with friends, track achievements, and view leaderboards. The app does not maintain its own game data — all game state, card data, user data, and social features come from the remote API.

The project also includes a lightweight Express server used primarily for serving a landing page and proxying during development; it is not the primary backend for game logic.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React Native + Expo)

- **Framework**: Expo SDK 54 with React Native 0.81, using the new architecture
- **Routing**: Expo Router v6 with file-based routing. The `app/` directory defines all screens:
  - `app/(tabs)/` — Main tab navigation (Home, Cards, Decks, Social, More)
  - `app/card/[id].tsx`, `app/commander/[id].tsx`, `app/deck/[id].tsx`, etc. — Detail/modal screens
  - `app/index.tsx` — Login/auth screen (entry point before authentication)
- **State Management**: TanStack React Query (`@tanstack/react-query`) for all server state — fetching cards, decks, rooms, friends, stats, achievements, etc.
- **Authentication**: JWT-based auth stored in `expo-secure-store`. Auth state is managed via React Context (`lib/auth-context.tsx`). The login flow sends email + optional name to the remote API and receives a JWT token.
- **API Client**: All API calls go through `lib/api.ts`, which manages the JWT token, makes authenticated requests to the remote backend, and defines TypeScript interfaces for all data types (Card, Commander, Deck, Friend, Room, etc.).
- **UI**: Dark theme matching the web app's exact Tailwind CSS palette (defined in `constants/colors.ts`). Uses slate-900 (#0f172a) background, slate-800 (#1e293b) surfaces, slate-700 (#334155) borders, purple-600 (#9333ea) primary accents, and slate-300/400/500 text hierarchy. Element-based color coding (fire, water, earth, air, nature). All 25+ screen files use centralized `Colors.*` references. Uses Inter font family, Ionicons/MaterialCommunityIcons, expo-linear-gradient, react-native-reanimated for animations, and expo-haptics for tactile feedback.
- **WebSocket**: Real-time multiplayer via `lib/websocket.ts` hook connecting to `wss://wisdom-and-chance.replit.app/ws?token=<jwt>` (JWT in URL query param). Auto-reconnect, heartbeat, `auth_success`/`auth_error` handling. All game actions sent via unified `game_action` event with `{ gameId, action: { type, ...params } }`. Room events: `join_room`, `leave_room`, `room_message`, `select_deck`, `toggle_ready`. Game events: `join_game`, `leave_game`, `game_action`. Server sends `game_state`, `game_action`, `game_start`, `game_over`, `room_update`, `player_ready_update`, `chat_message`, etc.
- **PvP Game Board**: `app/game/pvp-board.tsx` is the multiplayer battle screen. Uses the same landscape layout as the AI board but receives all game state from the server via WebSocket events instead of the local game engine. Player actions (deploy, undeploy, end turn, use ability) sent as `game_action` messages; combat results are animated when received. Includes "Waiting for opponent" overlay, opponent disconnect countdown, rematch flow, and reconnection handling. `adaptServerState()` normalizes server payloads to local `PvPGameState` interface. Room screen navigates to PvP board when `game_start` event is received, passing both `roomId` and `gameId`.
- **Deck Import/Export**: Export copies deck code to clipboard via `expo-clipboard` (deck view screen). Import via modal in Decks tab with text input for pasting deck codes.
- **Card Art & Portraits**: Centralized in `constants/card-art.ts`. Per-element card art images and commander portraits loaded from `https://wisdom-and-chance.replit.app/assets/`. Helper functions `getCardArt(card)` (uses card.imageUrl or falls back to element art), `getCommanderPortrait(element)`, `getCardImageUrl(cardId)` (returns `/api/cards/:id/image` URL), and `getCommanderImageUrl(commanderId)` (returns `/api/commanders/:id/image` URL). The `AuthImage` component (`components/AuthImage.tsx`) wraps React Native's `Image` with Bearer token auth headers from SecureStore, with automatic fallback to element-based art on error or missing token.
- **Card Frame Components**: `components/CardFrame.tsx` and `components/CommanderFrame.tsx` are pixel-perfect React Native replicas of the website's card rendering. CardFrame supports 4 sizes (sm/md/lg/xl), element-colored borders, power/trait badges, card art, buff/debuff colored indicators, face-down mode, selected/disabled states, and count badges. CommanderFrame renders full portrait with element header bar, gradient overlay with name/title, and ability pills. Both are used across Cards tab (3-column grid), Card/Commander detail screens, Deck builder/view/edit (card selection grid), Home screen (featured cards/decks), and Decks tab (commander previews).
- **Game Board (Landscape-Only)**: `app/game/board.tsx` is the single-player AI battle screen. It locks to landscape orientation on native via `expo-screen-orientation` (LANDSCAPE lock on mount, PORTRAIT_UP restore on unmount, with cancelled-flag pattern to handle rapid mount/unmount). On web, if the viewport is portrait (width <= height), the entire game board is rotated 90° via CSS transform to enforce landscape display. Layout uses a **top-down vertical structure** inside the landscape view (similar to the web version / Hearthstone-style): opponent hand row at top, opponent's field, center strip (VS/combat results), player's field, and bottom panel (hand cards + abilities + battle button). All sections have fixed/computed heights that sum to exactly the available `contentH`, ensuring zero scrolling. Card sizes are dynamically computed from `effW`/`effH` effective landscape dimensions. Hold any hand card for 500ms to preview its details in a popup (native onLongPress with pressRetentionOffset for finger-drift tolerance, works in all game phases). Tap face-up opponent cards after combat to inspect them.
- **Game Modes**: Practice mode supports Standard (2/2) and Extended (3/3) game modes. Standard draws 2 cards and allows deploying up to 2 per turn; Extended draws 3 and allows 3. Mode is selected on the practice setup screen (`app/practice.tsx`) and passed to the board via route params. `GameState` stores `cardsDrawnPerTurn` and `cardsDeployedPerTurn` from `lib/game-engine.ts`, and `lib/ai-player.ts` respects these values.
- **Combat History**: Round results (`RoundResult` in `lib/game-engine.ts`) include trait effect details (Quick Strike damage, Guardian block, Restoration healing) for both players, plus an optional `abilityEffects` array documenting commander ability activations with player side, ability name, effect description, and phase. The combat history modal displays traits, ability effects (color-coded green for player, red for opponent), power totals, card breakdowns, and damage.
- **Commander Ability System (v2.2.0)**: `AbilityBuff` types have special combat mechanics beyond power modification: `shield` buffs also block incoming damage (stacks with Guardian trait), `first_strike` buffs deal pre-combat HP damage (stacks with Quick Strike), `heal` buffs restore HP after combat (stacks with Restoration), `heal_buff` is power-only (no combat heal, prevents double-healing from `heal_and_buff`). The `first_strike` effect uses `effect.value || 3` for buff amount. `AbilityBuff` and `AbilityEffect` interfaces, `abilityBuffs` on `PlayerState`, and `abilityLog` on `GameState` track these during gameplay.
- **Commander Info Buttons**: Both game boards (AI practice + PvP) show two commander avatar buttons in the header — tap the left one to view your commander's details (name, element, title, description, abilities with costs), tap the right one to view the opponent's commander info (read-only). Uses `showDialog` states `'commanderInfo'` and `'oppCommanderInfo'`.
- **Fonts**: Inter (400, 500, 600, 700) loaded via `@expo-google-fonts/inter`

### Backend (Express - Lightweight)

- **Purpose**: The Express server in `server/` is a thin layer — primarily for serving a landing page in production, proxying API requests to the remote backend, and handling CORS. It is NOT the game backend.
- **The real backend** is the remote service at `https://wisdom-and-chance.replit.app` which provides all REST API endpoints and WebSocket support.
- **API Proxy**: `server/routes.ts` proxies all `/api/*` requests to the remote backend. On web, the app routes API calls through this proxy to avoid CORS issues. On mobile (Expo Go), the app calls the remote backend directly.
- **Routes**: `server/routes.ts` contains the API proxy middleware.
- **Storage**: `server/storage.ts` has an in-memory storage class (`MemStorage`) with basic user CRUD — this is a placeholder/template and not actively used for game functionality.

### Database Schema (Local - Minimal)

- **Drizzle ORM** with PostgreSQL is configured (`drizzle.config.ts`, `shared/schema.ts`) but only defines a basic `users` table (id, username, password). This is from the template and is not the primary data store — all game data comes from the remote API.
- Schema location: `shared/schema.ts`
- Migrations output: `./migrations`
- If adding local database features, use Drizzle with the existing schema pattern and `db:push` script.

### WebSocket Protocol (Server-Authoritative)

- **Connection**: `wss://wisdom-and-chance.replit.app/ws?token=<jwt>` (JWT as URL query param for mobile)
- **Auth**: Server sends `auth_success` or `auth_error` after connection
- **Client → Server Events**: `join_room`, `leave_room`, `join_game`, `leave_game`, `room_message`, `game_message`, `select_deck`, `toggle_ready`, `game_action`, `send_emote`, `join_matchmaking`, `cancel_matchmaking`
- **Server → Client Events**: `auth_success`, `auth_error`, `room_update`, `game_start` (with `{ roomId, gameId }`), `game_state`, `game_action`, `game_over`, `chat_message`, `game_message`, `player_joined`, `player_left`, `player_ready_update`, `presence_update`, `friend_request`, `friend_request_accepted`, `friend_message`, `spectator_joined`, `spectator_left`, `matchmaking_found`
- **Game Actions**: Sent via `{ type: 'game_action', gameId, action: { type: 'deploy_card'|'undeploy_card'|'end_turn'|'use_ability'|'rematch', ... } }`
- **State Adapter**: `adaptServerState()` in `pvp-board.tsx` normalizes server game state (handles `field`/`deployed`, `advanceCounters`/`victoryCurrency`, `cardsToDeploy`/`cardsDeployedPerTurn` naming variations)

### Key Design Decisions

1. **Remote API architecture**: The app is deliberately a thin client. No local database for cards, decks, or game state. This means all features depend on network connectivity to the remote backend.
2. **JWT auth with SecureStore**: Tokens are stored securely on-device and sent as Bearer tokens. Token refresh is supported.
3. **File-based routing with Expo Router**: Modal presentations for detail screens (cards, commanders, decks, rooms). Tab-based main navigation.
4. **Two query client setups exist**: `lib/query-client.ts` (template-based, for local Express server) and `lib/api.ts` (actual API client for remote backend). The app primarily uses `lib/api.ts` for data fetching.

### Build & Development

- **Dev**: Run `npm run expo:dev` (Expo) and `npm run server:dev` (Express) concurrently
- **Production build**: `npm run expo:static:build` creates a static web build, `npm run server:build` bundles the Express server, `npm run server:prod` runs it
- **Database**: `npm run db:push` pushes Drizzle schema to PostgreSQL

## External Dependencies

### Remote Backend API
- **URL**: `https://wisdom-and-chance.replit.app`
- **Documentation**: `GET /api/docs` returns complete API documentation
- **Health check**: `GET /api/health`
- **Auth endpoints**: `/api/mobile/auth/login`, `/api/mobile/auth/refresh`, `/api/mobile/auth/me`
- **Game endpoints**: Cards, commanders, decks, rooms, friends, messages, achievements, leaderboards — all under `/api/`

### Database
- PostgreSQL via `DATABASE_URL` environment variable (used by Drizzle for the local schema, though the app primarily relies on the remote backend)

### Key NPM Dependencies
- `expo` ~54.0.27 — Core framework
- `expo-router` ~6.0.17 — File-based routing
- `@tanstack/react-query` ^5.83.0 — Server state management
- `expo-secure-store` — Secure JWT storage
- `drizzle-orm` / `drizzle-zod` — ORM (for local schema, minimal usage)
- `express` ^5.0.1 — Lightweight local server
- `pg` ^8.16.3 — PostgreSQL client
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens` — Navigation and animation
- `expo-haptics` — Haptic feedback
- `expo-linear-gradient` — Gradient UI elements