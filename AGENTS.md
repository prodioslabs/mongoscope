# Agent guidelines

## Component props

Define a named props type (expanded, one field per line) and destructure it in the component signature. Rename when a prop collides with a local binding.

```tsx
// ❌ BAD
export function ThemeProvider(props: { mode?: ThemeMode; theme?: string; children?: ReactNode }) {
  return <>{props.children}</>
}

// ✅ GOOD
type ThemeProviderProps = {
  mode?: ThemeMode
  theme?: string
  children?: ReactNode
}

export function ThemeProvider({ mode, theme: themeName, children }: ThemeProviderProps) {
  return <>{children}</>
}
```

## React effects

Always pass a **named function** to `useEffect` and `useLayoutEffect`. The name must convey the effect’s role (what it synchronizes, subscribes to, or applies).

```tsx
// ❌ BAD — anonymous arrow hides intent in stacks and reviews
useEffect(() => {
  renderer.setBackgroundColor(theme.background)
}, [renderer, theme.background])

// ✅ GOOD — name states the effect’s job
useEffect(
  function applyThemeBackground() {
    renderer.setBackgroundColor(theme.background)
  },
  [renderer, theme.background],
)
```

Do not use anonymous arrow functions or unnamed function expressions for effect callbacks.
