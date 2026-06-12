# Personal Website

A single-page portfolio built around an ML training metaphor: scroll through noise → labeling → training → convergence → inference. The background particle field morphs with each stage as you move down the page.

## Features

- Scroll-driven narrative with five scenes (hero, experience, projects, about, contact)
- Three.js particle field that transitions between noise, grid, clusters, network, and glyph states
- Live training HUD (epoch, loss, stage) synced to scroll position
- Annotation mode — toggle bounding boxes on key elements
- Custom cursor, magnetic buttons, and scroll-triggered reveals
- Responsive layout with reduced-motion support

## Project structure

```
Personal Website/
├── index.html       # Page markup
├── css/
│   └── styles.css   # Styles and design tokens
├── js/
│   └── main.js      # Boot sequence, Three.js field, interactions
└── README.md
```

## Getting started

No build step or dependencies to install. Open the site in a browser:

**Option 1 — open directly**

Double-click `index.html`, or from the project folder:

```bash
open index.html
```

**Option 2 — local server (recommended)**

Some browsers restrict local file loading for external scripts. If anything fails to load, serve the folder instead:

```bash
# Python 3
python3 -m http.server 8000

# Node (npx)
npx serve .
```

Then visit `http://localhost:8000`.

## Tech stack

- HTML, CSS, JavaScript (vanilla)
- [Three.js r128](https://threejs.org/) — particle background (CDN)
- [Inter](https://rsms.me/inter/) — typography (CDN)

## Sections

| Stage       | Section      | Content                          |
|-------------|--------------|----------------------------------|
| Noise       | Hero         | Intro and CTAs                   |
| Labeling    | Experience   | Work history and community       |
| Training    | Projects     | ML and software projects         |
| Convergence | About        | Skills, education, model card    |
| Inference   | Contact      | Email and social links           |

## Contact

- **Email:** fadil.gbon@gmail.com
- **GitHub:** [fadilgbon](https://github.com/fadilgbon)
- **LinkedIn:** [fadilgbon](https://www.linkedin.com/in/fadilgbon/)

## License

Personal portfolio — all rights reserved.
