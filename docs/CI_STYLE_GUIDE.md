# Corporate Identity – Style Guide

> The system isn't working. The design must speak clearly.

---

## 🎨 Color System

| Role         | Light Mode (lofi) | Dark Mode (abyss) |
|--------------|-------------------|--------------------|
| Primary      | `#C06030` (Terracotta) | `#C06030` (same) |
| Accent       | `#ff1d25` (Altrosa) | `#ff1d25` (Altrosa) |
| Neutral BG   | `#fafafa` | `#0f172a` |
| Text Primary | `#000000` | `#ffffff` |
| Highlight    | `#e6c373` | `#e6c373` |
| Error/Alert  | `#b91c1c` | `#fca5a5` |

Tokens (e.g. for Tailwind/DaisyUI):
```css
--primary: #C06030;
--accent: #ff1d25;
--base-100: #fafafa; /* or #0f172a for dark */
```

---

## 🔤 Typography

**Headings**  
- Font: `Space Grotesk`  
- Weight: `semibold` or `bold`  
- Case: Sentence case or UPPERCASE for system elements  
- Spacing: `tracking-tight`

**Body**  
- Font: `Space Grotesk` or `JetBrains Mono`  
- Weight: Regular  
- Line-height: `1.75`  
- Max width: `65ch`

**Code/UI**  
- Font: `JetBrains Mono`  
- Size: 90% of body, never full caps  
- Background: subtle `base-200`

---

## 🧱 Layout & Whitespace

> *Whitespace is not empty. It gives space to breathe.*

- Content blocks: generous `padding` and `margin`
- Avoid dense UIs — one idea per screen or component
- Use `max-w-screen-md` or `max-w-screen-lg` for readable layouts
- Tailwind spacing scale: prefer `p-6`, `mb-8`, `gap-10`, `space-y-12`

✅ No boxed-in elements unless for intentional contrast  
✅ Use whitespace to separate logic, not just aesthetics

---

## 🖼 Icon & Image Style

- Use outline or flat icons — no skeuomorphism
- Images should feel *documentary* or *infrared*, not corporate
- Grayscale or duotone preferred unless color adds meaning

---

## ✍️ Tone of Voice

- Direct, clear, non-institutional
- "We" = collective subject. Avoid "users", "clients"
- Active voice where possible
- Don't overexplain — trust the reader

---

## 💡 Examples

```html
<!-- Good -->
<section class="max-w-screen-md mx-auto px-8 py-12 space-y-8">
  <h1 class="text-3xl font-semibold tracking-tight">systemfehler</h1>
  <p class="text-base leading-7">
    Wer hat Zugriff auf öffentliche Mittel? Recherchen zu Ausschlüssen, Hürden und Verweigerungen.
  </p>
</section>
```

---

End of CI Style Guide v0.1
