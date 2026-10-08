# AGENTS.md — Development Guidelines & Architecture

> [!IMPORTANT]
> **Expo SDK 54 Notice**: Always refer to the exact versioned documentation at [https://docs.expo.dev/versions/v54.0.0/](https://docs.expo.dev/versions/v54.0.0/) before adding packages or writing Expo/React Native code. React 19 and New Architecture (`newArchEnabled: true`) are enabled.

---

## 1. Tech Stack

- **Framework:** [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) (~54.0.36)
- **Runtime / Core:** React Native (0.81.5), React (19.1.0)
- **Language:** Strict TypeScript (no `any` types)
- **Local Persistence:** `@react-native-async-storage/async-storage` (v2.2.0)
- **Connectivity Detection:** `@react-native-community/netinfo` (v11.4.1)
- **Status Bar:** `expo-status-bar` (~3.0.9)
- **Architecture Flag:** React Native New Architecture enabled (`newArchEnabled: true`), Android edge-to-edge layout enabled

---

## 2. Modular Architecture

Maintain a strict modular folder structure under `src/`:

```
assignment-tracker/
├── assets/                  # App icons, splash screens, static assets
├── src/
│   ├── types/               # TypeScript interfaces, types, and enums (strictly typed)
│   │   ├── assignment.ts
│   │   └── storage.ts
│   ├── services/            # Business logic, storage abstraction, and NetInfo services
│   │   ├── storageService.ts
│   │   ├── assignmentService.ts
│   │   └── networkService.ts
│   ├── screens/             # Screen-level container components
│   │   ├── HomeScreen.tsx
│   │   ├── AssignmentDetailScreen.tsx
│   │   └── AddEditAssignmentScreen.tsx
│   ├── components/          # Reusable, presentational UI components
│   │   ├── AssignmentCard.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── OfflineBanner.tsx
│   ├── hooks/               # Custom React hooks (consuming services)
│   │   ├── useAssignments.ts
│   │   └── useNetworkStatus.ts
│   └── utils/               # Date helpers, formatters, constants
│       ├── dateUtils.ts
│       └── constants.ts
├── App.tsx                  # Main application root
├── app.json                 # Expo configuration
├── tsconfig.json            # TypeScript configuration
├── package.json
└── AGENTS.md                # Agent instructions and guidelines
```

---

## 3. Core Guidelines & Rules

### 3.1 Strict TypeScript (No `any` Types)
- **Zero `any` Policy:** Explicitly define interfaces/types for all state, props, function parameters, and return types. Use `unknown` with type guards if dealing with uncertain external data.
- **Data Models:** Define clear domain types in `src/types/assignment.ts`:
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
- **Dedicated Services (`src/services/`):** All `AsyncStorage` and `@react-native-community/netinfo` calls MUST be contained inside `src/services/` (e.g., `storageService.ts`, `assignmentService.ts`).
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
