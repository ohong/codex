# Design Style Guide
⸻

1. Design Philosophy

“Buildings can exist in the landscape without overpowering it.” — The Sea Ranch Design Manual (1964–2013)

The Sea Ranch web aesthetic translates the architectural ideals of restraint, humility, community, and harmony with the natural setting into digital form. Every component, animation, and interaction should feel as though it was grown rather than placed—emerging naturally from its context.
	•	Goal: Simplicity that reveals depth.
	•	Tone: Calm, timeless, grounded in nature.
	•	Mood: Mist, wood, wind, and sunlight—quiet confidence, never flamboyance.
	•	Guiding principle: Design recedes to let content and environment speak.

⸻

2. Visual Identity

2.1 Color Palette — “The Northern Coast”

Draw directly from Sea Ranch’s coastal ecology: muted, fog-filtered tones that feel organic and timeless. Avoid saturated color; think weathered wood, sea grass, cypress bark, and fog-lit ocean.

Element	Color	Description	Hex
Primary Base	Weathered Driftwood	Backgrounds, cards	#E4E0DB
Secondary Base	Sandstone Gray	Alternate sections	#CFC9C2
Accent 1	North Coast Green	Buttons, links (hover)	#667A6E
Accent 2	Cypress Brown	Typography emphasis	#5A4E42
Highlight	Fog Blue	Interactive focus or selection	#9BA9A4
Background Contrast	Off-Black Pebble	For dark mode / footer	#1F1F1D
Text on Light	Charcoal	Body text	#2D2A26
Text on Dark	Mist	On dark backgrounds	#F3F2EF

Rule: Every color must appear as if faded by salt air and time. No pure white, no true black, no neon.

⸻

3. Typography

3.1 Typefaces — “Ordinary Architecture”

The type system mirrors Sea Ranch’s material honesty: simple, legible, and crafted from modest means.

Use	Typeface	Characteristics
Display / Headings	Adobe Caslon Pro or Crimson Text	Evokes early Californian serif signage; warm, literary, timeless.
Body / Interface	Inter or IBM Plex Sans	Clean, rational, quietly modern.
Monospace / Metadata	IBM Plex Mono	For coordinates, captions, or timestamps.

Styling Rules
	•	Headings use minimal letter-spacing (-0.015em); uppercase only when structurally necessary.
	•	Body text comfortable at 18–20 px with 1.6 line-height.
	•	No decorative fonts; no “flamboyant” display types.

Typography should feel printed, not digital—like a field guide or an architectural notebook.

⸻

4. Layout & Composition

4.1 Grid System — “The Commons”

Use a modular grid that creates breathing room, echoing meadows separated by hedgerows.
	•	Grid base: 8 px system.
	•	Max width: 960 px content column (desktop).
	•	Gutters: wide (32–64 px) to create negative space.
	•	Section rhythm: generous padding top/bottom (min 96 px).

4.2 Structure
	•	Hero areas: minimal copy, subdued imagery, large negative space.
	•	Sections: stacked like architectural “volumes,” separated by muted background shifts.
	•	Navigation: fixed top bar in translucent fog-gray (rgba(231,229,224,0.8)), blending into content.
	•	Footers: dark, quiet; text in small caps; links in low-contrast gray.

Each page should feel like walking a coastal trail—slow transitions, wide horizons, and sudden views.

⸻

5. Imagery & Motion

5.1 Photography
	•	Prefer natural light, misty tones, and textural details (wood grain, fog, cliffs).
	•	No heavy filters, no overlays, no staged studio lighting.
	•	Crop asymmetrically—suggest the continuation beyond the frame.

5.2 Illustration
	•	Line-based, architectural sketch style.
	•	Use soft graphite or thin ink line weights (1–2 px) on muted paper backgrounds.

5.3 Motion & Interaction
	•	Animations must breathe slowly.
	•	Fade in/out: 300–500 ms
	•	Slide transitions: ease-in-out
	•	Hover states alter tone / contrast subtly (no color jumps).
	•	Parallax and scroll effects should simulate depth of field, not spectacle.

Motion at Sea Ranch is the movement of fog, not fireworks.

⸻

6. Components

6.1 Buttons

Property	Rule
Shape	Rounded 2 px or pill, minimalist
Border	1 px solid #5A4E42
Background	Transparent by default; fill on hover
Typography	Uppercase, 0.8 em letter-spacing
Motion	Fade to North Coast Green on hover

Example (SCSS):

.button {
  font-family: "Inter", sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5A4E42;
  border: 1px solid #5A4E42;
  padding: 0.75rem 1.25rem;
  background: transparent;
  transition: all 0.3s ease-in-out;
}
.button:hover {
  background: #667A6E;
  color: #F3F2EF;
}

6.2 Cards
	•	Background: Weathered Driftwood #E4E0DB
	•	Border radius: 4 px
	•	Shadow: none or extremely subtle (0 2px 6px rgba(0,0,0,0.05))
	•	Internal padding: 32 px
	•	Optional divider line 1 px solid #CFC9C2

6.3 Forms
	•	Inputs: border-bottom: 1px solid #667A6E;
	•	Focus state: soft shadow 0 1px 0 #9BA9A4
	•	Labels: small caps; spacing 4 px above field
	•	Buttons aligned right, not centered

⸻

7. Content & Voice

Tone: Clear, communal, and humble—avoiding self-promotion.

Principle	Digital Equivalent
Nature predominates	Content outweighs UI; minimal chrome.
Community	Shared authorship: credits, collaborative features, open data.
Modesty of house size	Compact modules, no oversized hero sections.
Diversity	Inclusive imagery, varied layouts, accessibility first.
Simplicity	Reduce ornament to essentials—let whitespace do the work.

Writing Style
	•	Use short declarative sentences.
	•	Prefer nouns to adjectives.
	•	Titles in Title Case; subheads in sentence case.
	•	Avoid marketing language; write like an architect’s field note.

⸻

8. Iconography

8.1 Style
	•	Outline weight: 1.25 px
	•	Corners: rounded joins
	•	Color: Cypress Brown #5A4E42
	•	Metaphor: simple, functional objects—compass, house, leaf, path.

8.2 Usage
	•	Use sparingly—icons should clarify, not decorate.
	•	Never accompany every link; reserve for navigation or data types.

⸻

9. Accessibility & Responsiveness
	•	WCAG AA+ contrast ratio minimum 4.5:1
	•	Use prefers-color-scheme to offer fog light and coastal night themes.
	•	Typography and spacing scale fluidly (clamp() CSS functions).
	•	Navigation collapses into slide-over drawer—no pop animation, just subtle fade.

⸻

10. Spatial Rhythm & Sound
	•	Scroll pacing: Content sections ~80–100 vh; long scroll with intermittent full-bleed imagery.
	•	Sound design (optional): ambient coastal background—waves + wind—volume < 5 %.
Interactive sounds, if used, should be wood-on-wood, cloth, or stone tones—never synthetic.

⸻

11. Code Conventions

11.1 Framework Recommendations
	•	Frontend: Next.js / Astro / Remix
	•	Styling: Tailwind CSS (with custom theme tokens below)
	•	Typography: use CSS variables for modular scale

// tailwind.config.js excerpt
theme: {
  extend: {
    colors: {
      driftwood: '#E4E0DB',
      sandstone: '#CFC9C2',
      cypress: '#667A6E',
      brown: '#5A4E42',
      fogblue: '#9BA9A4',
      pebble: '#1F1F1D',
      mist: '#F3F2EF',
    },
    fontFamily: {
      serif: ['"Crimson Text"', 'serif'],
      sans: ['Inter', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'monospace'],
    },
  },
}

11.2 Component Architecture
	•	Atomic structure: atoms (buttons, inputs) → molecules (cards, nav) → organisms (layout sections).
	•	Global styles handle typography rhythm and spacing.
	•	All components must respect the base 8 px grid.

⸻

12. Inspiration Board (Digital Parallels)

Architectural Principle	Web Equivalent
Design control, modesty, restraint	Strong design system; avoid visual noise.
Clustered housing & shared commons	Grid layouts, community dashboards.
Natural materials	Textured backgrounds (paper, linen, wood) in subtle opacity.
Weathering & time	Gentle gradients, desaturated filters, slow transitions.
Harmony with site	Responsive layouts that adapt gracefully, not abruptly.


⸻

13. Implementation Notes
	•	Static feel: prefer calm over kinetic. Avoid continuous animation loops.
	•	Textures: apply a faint paper grain (opacity: 0.03) to backgrounds to avoid sterile flatness.
	•	Light direction: subtle top-left shadows to mimic sun orientation.
	•	Environmental respect: ensure low-energy assets; lazy-load images, no autoplay videos.

⸻

14. Example Layout Concept

┌───────────────────────────────────────────────┐
│ NAV: logo (left) — links (right) — fog-glass │
├───────────────────────────────────────────────┤
│ HERO: full-bleed photo (coastline, muted)     │
│       headline in Caslon serif                │
│       subhead in Inter sans, fog-blue         │
├───────────────────────────────────────────────┤
│ CONTENT BLOCKS (3–5):                         │
│   • text left / image right alternation        │
│   • generous margins, fade-in on scroll       │
│   • color alternates driftwood / sandstone    │
├───────────────────────────────────────────────┤
│ FOOTER: dark pebble bg, smallcaps links       │
│         copyright in mist text                │
└───────────────────────────────────────────────┘


⸻

15. Ethical & Cultural Notes

The Sea Ranch legacy is one of stewardship, not ownership.
In web design terms, that means:
	•	Respect content longevity; avoid ephemeral trends.
	•	Prioritize environmental performance (minimal bandwidth, efficient code).
	•	Foster collaboration—invite others to build on your framework.

The ultimate success of a Sea Ranch-inspired interface lies not in its visual novelty, but in how lightly it lives upon the screen.

⸻

Closing Reflection

“Ordinary architecture is not ordinary—it’s architecture allowed to do what it was meant to do.” — Charles W. Moore

Your website should embody that same humility: nothing superfluous, nothing performative, every line of code and pixel chosen because it quietly belongs.
