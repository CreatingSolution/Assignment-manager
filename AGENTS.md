# AGENTS.md — Development Guidelines & Architecture

> [!IMPORTANT]
> **Expo SDK 58 Notice**: Always refer to the exact versioned documentation at [https://docs.expo.dev/versions/v58.0.0/](https://docs.expo.dev/versions/v58.0.0/) before adding packages or writing Expo/React Native code. React 19 and New Architecture (`newArchEnabled: true`) are enabled.

---

## 1. Tech Stack

- **Framework:** [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) (~58.0.19)
- **Runtime / Core:** React Native (0.88.0), React (19.3.0)
- **Language:** Strict TypeScript (no `any` types)
- **Local Persistence:** `@react-native-async-storage/async-storage` (v2.2.0)
- **Connectivity Detection:** `@react-native-community/netinfo` (v12.0.1)
- **Status Bar:** `expo-status-bar` (~58.0.4)
- **Architecture Flag:** React Native New Architecture enabled (`newArchEnabled: true`), Android edge-to-edge layout enabled

---

## 2. Modular Architecture

Maintain this modular folder structure at the project root (there is **no** `src/` folder). Use the `@/` path aliases from `tsconfig.json` (e.g. `@/services/...`, `@/hooks/...`).

```
Assignment-manager/
├── app/                     # expo-router screens (file-based routing; entry: index.js -> expo-router/entry)
│   ├── _layout.tsx          # Root layout
│   ├── (auth)/              # login.tsx, register.tsx
│   └── (app)/               # index.tsx, smart-schedule.tsx, assignments/, groups/
├── components/              # Reusable UI components (pickers, modals)
├── hooks/                   # Custom React hooks (use-*.hook.ts), re-exported from hooks/index.ts
├── services/                # Business logic: auth, firestore, network, notifications, OCR, scheduler
├── database/                # expo-sqlite schema, migrations, and repositories/
├── store/                   # zustand stores (network, sync, rewards)
├── sync/                    # Offline sync engine and queue
├── types/                   # Shared TypeScript types
├── utils/                   # Date and ID helpers
├── constants/               # App constants
├── assets/                  # App icons, splash screens, static assets
├── index.js                 # App entry point
├── app.json                 # Expo configuration
├── tsconfig.json            # TypeScript configuration and path aliases
└── AGENTS.md                # Agent instructions and guidelines
```

---

## 3. Core Guidelines & Rules

### 3.1 Strict TypeScript (No `any` Types)
- **Zero `any` Policy:** Explicitly define interfaces/types for all state, props, function parameters, and return types. Use `unknown` with type guards if dealing with uncertain external data.
- **Data Models:** Define clear domain types in `types/index.ts`:
  ```typescript
  export type Priority = 'low' | 'medium' | 'high';
  export type AssignmentStatus = 'pending' | 'in_progress' | 'completed';

  export interface Assignment {
    id: string;
    title: string;
    course: string;
    description?: string;
    dueDate: string; // ISO 8601 string
    priority: Priority;
    status: AssignmentStatus;
    createdAt: string; // ISO 8601 string
    updatedAt: string; // ISO 8601 string
    isSyncPending?: boolean;
  }
  ```

### 3.2 Service Layer & Business/Storage Logic Separation
- **Dedicated Services (`services/`):** All `AsyncStorage` and `@react-native-community/netinfo` calls MUST be contained inside `services/`, `database/`, or `store/` — never in `app/` screens or `components/`.
- **Never Call Storage Directly in Components:** UI components and screens must not import or invoke `AsyncStorage` directly; they should interact via services or custom hooks (`useAssignments`).
- **Error Handling & Fallbacks:** Always handle storage read/write failures gracefully inside services with typed return values or safe fallback defaults (e.g. `[]`).

### 3.3 UI & Styling with React Native `StyleSheet`
- **React Native `StyleSheet` Only:** All component and screen styles must use `StyleSheet.create` for performance and consistency.
- **No Inline Style Objects for Static Layouts:** Keep styles organized at the bottom of the component file using `const styles = StyleSheet.create({ ... })`.
- **Edge-to-Edge & Safe Areas:** Account for status bar and safe area insets on Android and iOS devices.

---

## 4. Offline-First & Connectivity Strategy

1. **Local-First Writes & Reads:** All assignment creations, edits, deletions, and status toggles write to `AsyncStorage` immediately as the local single source of truth.
2. **Non-Blocking UI:** Operations must never block on network connectivity.
3. **Reactive Connectivity:** Use `@react-native-community/netinfo` to provide non-intrusive offline/online status indicators (e.g., banner/badge).

---

## 5. Development & Testing Workflow

### Common Commands
- **Start Metro Bundler:** `npx expo start`
- **Run on Android:** `npx expo start --android`
- **Run on iOS:** `npx expo start --ios`
- **Run on Web:** `npx expo start --web`
- **Type Check:** `npx tsc --noEmit`
- **Install Packages:** `npx expo install <package-name>` (Always use `npx expo install` for SDK 54 compatibility)

### Offline Verification Checklist
1. **Cold Start Persistence:** App loads persisted assignments immediately from `AsyncStorage` without network.
2. **Offline CRUD:** Add, update, toggle status, and delete items with network disabled.
3. **Connectivity Transitions:** Test switching network off/on to ensure UI state remains consistent.
