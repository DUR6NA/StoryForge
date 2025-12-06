# StoryForge Theme System

The StoryForge launcher features a comprehensive theming system that allows complete customization of the visual appearance, sounds, and effects.

## Quick Start

1. Go to **Settings** in the launcher sidebar
2. Click **Open Themes** to access the Theme Gallery
3. Select any theme to activate it immediately
4. Upload your own themes using the **Upload Theme** button

## Theme Structure

A theme is a folder containing a `theme.json` file and optional asset files:

```
my-theme/
├── theme.json          # Required - Theme configuration
├── preview.png         # Optional - Preview image (shown in gallery)
├── background.jpg      # Optional - Background image
├── background.mp4      # Optional - Background video
├── click.mp3           # Optional - Button click sound
├── hover.mp3           # Optional - Hover sound effect
├── navigate.mp3        # Optional - Navigation sound
├── notify.mp3          # Optional - Notification sound
└── ambient.mp3         # Optional - Background music
```

## Theme.json Structure

```json
{
    "meta": {
        "id": "my-theme-id",
        "name": "My Theme Name",
        "author": "Your Name",
        "version": "1.0.0",
        "description": "A description of your theme",
        "preview": "preview.png",
        "isBuiltIn": false
    },
    "colors": {
        "primary": "#6366f1",
        "secondary": "#ec4899",
        "accent": "#8b5cf6",
        "background": "#020617",
        "surface": "#1e293b",
        "surfaceAlt": "#0f172a",
        "border": "#374151",
        "text": "#f3f4f6",
        "textMuted": "#9ca3af",
        "textDim": "#6b7280",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "error": "#ef4444",
        "info": "#3b82f6"
    },
    "buttons": {
        "primary": {
            "background": "#6366f1",
            "text": "#ffffff",
            "border": "transparent",
            "hoverBackground": "#4f46e5",
            "hoverText": "#ffffff",
            "activeBackground": "#4338ca"
        },
        "secondary": {
            "background": "transparent",
            "text": "#9ca3af",
            "border": "#374151",
            "hoverBackground": "#1f2937",
            "hoverText": "#f3f4f6",
            "activeBackground": "#374151"
        }
    },
    "sidebar": {
        "background": "#1e293b",
        "itemBackground": "transparent",
        "itemBackgroundActive": "rgba(99, 102, 241, 0.2)",
        "itemText": "#9ca3af",
        "itemTextActive": "#6366f1",
        "borderColor": "#374151"
    },
    "cards": {
        "background": "#1e293b",
        "border": "rgba(55, 65, 81, 0.5)",
        "hoverBorder": "rgba(99, 102, 241, 0.5)",
        "shadow": "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
    },
    "inputs": {
        "background": "#0f172a",
        "border": "#374151",
        "focusBorder": "#6366f1",
        "text": "#f3f4f6",
        "placeholder": "#6b7280"
    },
    "scrollbar": {
        "track": "#1e293b",
        "thumb": "#475569",
        "thumbHover": "#64748b"
    },
    "background": {
        "type": "solid",
        "value": "#020617",
        "overlay": null
    },
    "effects": {
        "blur": true,
        "glassmorphism": true,
        "animations": true,
        "shadows": true
    },
    "sounds": {
        "enabled": true,
        "buttonClick": "click.mp3",
        "buttonHover": "hover.mp3",
        "navigation": "navigate.mp3",
        "notification": "notify.mp3",
        "backgroundMusic": "ambient.mp3",
        "volume": 0.5
    },
    "fonts": {
        "primary": "Inter, system-ui, sans-serif",
        "heading": "Inter, system-ui, sans-serif",
        "mono": "ui-monospace, Consolas, monospace"
    }
}
```

## Background Types

The `background.type` field supports:

| Type | Value | Description |
|------|-------|-------------|
| `solid` | Hex color (e.g., `#020617`) | Single solid color |
| `gradient` | CSS gradient | Any valid CSS gradient |
| `image` | Filename | JPG, PNG, or WebP image file |
| `video` | Filename | MP4 or WebM video file |

### Examples

**Solid Color:**
```json
"background": {
    "type": "solid",
    "value": "#020617"
}
```

**Gradient:**
```json
"background": {
    "type": "gradient",
    "value": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
}
```

**Image:**
```json
"background": {
    "type": "image",
    "value": "background.jpg",
    "overlay": "rgba(0, 0, 0, 0.5)"
}
```

**Video:**
```json
"background": {
    "type": "video",
    "value": "background.mp4",
    "overlay": "rgba(0, 0, 0, 0.6)"
}
```

## Sound Files

Sound files should be placed in the theme folder. Recommended formats:
- **MP3** - Best compatibility
- **WAV** - High quality
- **OGG** - Good compression

Keep sound files small for quick loading:
- Click/hover sounds: < 100KB
- Background music: < 5MB

## Color Palette Tips

### Creating a Cohesive Palette

1. **Primary** - Main brand/accent color
2. **Secondary** - Complementary accent
3. **Accent** - Highlight color for special elements
4. **Background** - Main app background (darkest)
5. **Surface** - Cards, sidebars, modals
6. **SurfaceAlt** - Slightly different surface for depth

### Color Contrast

Ensure text colors have sufficient contrast:
- `text` on `background/surface`: 4.5:1 minimum
- `textMuted` on `background/surface`: 3:1 minimum

## Uploading Themes

1. Create a folder with your theme files
2. ZIP the folder (the theme.json should be inside)
3. Click **Upload Theme** in the Theme Gallery
4. Select your ZIP file

The theme will be installed to `themes/user/<theme-id>/`

## Deleting Themes

- Click the trash icon on any user-uploaded theme
- Built-in themes cannot be deleted

## Template

Download the theme template from the Theme Gallery to get started quickly!

## Tips

1. **Test your theme** with both light and dark content
2. **Use subtle transparency** for glassmorphism effects
3. **Keep accent colors consistent** across buttons, links, and highlights
4. **Test video backgrounds** for performance on lower-end devices
5. **Compress images** to keep load times fast
