# Undeniable Webflow Utils

## 📁 Structure

```
undeniable/
├── auth-modal.js           # Modal authentication logic
├── completion-tracking.js  # Video progress tracking  
├── custom-links.js         # Memberstack custom links
├── loom-management.js      # Video optimization & pause
├── confetti.js            # Animated confetti effects
└── README.md              # Documentation
```

## 🚀 How to Use

### 1. Required Library (Add to Webflow before `</body>`):
```html
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
```

### 2. Button Setup in Webflow:
Mark complete buttons need both attributes:
- `class="mark-complete-btn"` (for completion tracking)
- `ms-code-confetti="explosions"` (for celebration effect)

Available confetti effects: `falling`, `single`, `sides`, `explosions`, `bottom`

### 3. In Webflow Page Settings (before `</body>`):
