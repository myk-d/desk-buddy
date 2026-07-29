---
name: add-ipc-channel
description: Wire up a new IPC channel between the Electron main process and renderer in the Gaze Buddy Hub desktop app. Use for any new window.api.* surface not tied to a device WiFi HTTP endpoint (see add-wifi-endpoint for that case).
---

# Add a new IPC channel

Three files move together every time. A typecheck failure naming a `window.api.*` property almost always means one of these three was missed — verify with the `app-typechecker` agent after.

## 1. `electron/main.ts` — the handler

Request/response (renderer calls, main responds):

```ts
ipcMain.handle('namespace:action', async (_, arg1: string) => {
  // ... do the thing ...
  return result;
});
```

Fire-and-forget from main → renderer (push), for data that originates in the main process (a poller, a background fetch) rather than a request:

```ts
mainWindow?.webContents.send('namespace:event', data);
```

## 2. `electron/preload.ts` — the bridge

```ts
namespace: {
  action: (arg1: string) => ipcRenderer.invoke('namespace:action', arg1),
  onEvent: (cb: (data: SomeType) => void) => ipcRenderer.on('namespace:event', (_, data) => cb(data)),
},
```

## 3. `src/types.ts` — the type declaration

Under `Window.api`:

```ts
namespace: {
  action: (arg1: string) => Promise<ResultType>;
  onEvent: (cb: (data: SomeType) => void) => void;
};
```

## Choosing request/response vs. push

- **Request/response** (`invoke`/`handle`): renderer-initiated actions — a button click, a form submit. This is the common case (`wifi:scan`, `wifi:connect`, `claude:setup`).
- **Push** (`send`/`on`): main-process-initiated updates the renderer needs to learn about without polling — mirrors `claude:state`/`claude:usage`/`firmware:progress`. Remember `useRemoteCollection` (if the data is otherwise CRUD-shaped) only does one-way renderer→main sync; if a background process on the main side is the source of truth, a push event is the only way the renderer finds out about changes, since there's no polling fallback anywhere in this codebase's hooks.

## Consuming it in a component

For request/response, just call `window.api.namespace.action(...)` directly (see any existing button handler). For push-based data, a small dedicated hook that fetches once on mount and subscribes to the push event is the established pattern:

```ts
function useSomething() {
  const [value, setValue] = useState<SomeType | null>(null);
  useEffect(() => {
    window.api.namespace.get?.().then(setValue); // if a getter also exists
    window.api.namespace.onEvent(setValue);
  }, []);
  return value;
}
```

## Verify

`npx tsc --noEmit` in `desktop-app/` (or delegate to `app-typechecker`) — catches a missed file in any of the three immediately.
