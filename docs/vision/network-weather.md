# Network Weather: A Living Textile for Social Understanding

## The Idea

When you look out a window, you don't read a dashboard about the weather. You _see_ it. The light has a quality. The sky has a texture. You know something about the day before you think about it.

Network Weather gives you that same ambient understanding of a social network. The background of ShadowSky is a living woven textile — a plaid whose threads are the currents of collective attention, whose crossings are the places where communities meet, and whose overall texture tells you something true about what it feels like out there right now.

You never need to look at it directly. But over days of using the app, you develop an intuition: "the weave is tight today — everyone's focused on the same thing" or "there are a lot of new thin threads appearing — something is fragmenting" or "the palette shifted warm overnight — something good happened."

---

## The Textile

### Threads

Each thread in the weave is a **narrative current** — not a hashtag, but a cluster of meaning. Pan's firehose detects these as groups of related conversations that share authors, language patterns, and reference chains. At any moment there might be 5-12 active currents.

A thread has:

- **Color** — derived from the character of the conversation (see palette below)
- **Width** — proportional to the volume of participation (unique authors, not post count — we don't want spam to widen a thread)
- **Opacity** — how concentrated vs. diffuse the conversation is (author_diversity_ratio). A thread that's mostly one community talking to itself is more opaque; a thread that's spread across many disconnected groups is more translucent.
- **Texture** — smooth threads are consensus; threads with a subtle grain or irregularity have more internal disagreement (sentiment variance within the cluster)

### The Weave

Threads run in two directions — this isn't arbitrary. The warp (vertical) represents **enduring conversations** — things that have been active for days or longer. The weft (horizontal) represents **emergent conversations** — things that appeared in the last few hours. This means:

- A plaid dominated by strong vertical bands with thin horizontal ones = a stable network, same ongoing discussions, not much new
- Sudden thick horizontal bands cutting across = something just happened, new conversations erupting
- A grid of similar-weight bands = a diverse, active network with many parallel conversations
- One band overwhelming everything = the network has collapsed into a single conversation (breaking news, major event)

### Crossings

Where a warp thread crosses a weft thread, the colors blend. These crossings are the most informationally rich points in the textile:

- **A bright, saturated crossing** = high engagement between those two narrative communities. People who were talking about the enduring topic are now also talking about the emergent one. This is where meaning is being made — where a new event gets interpreted through an existing lens.
- **A muted crossing** = the two communities are aware of each other but not engaging. Parallel conversations that haven't merged.
- **A crossing that's getting brighter over time** = two previously separate conversations are converging. This is emergence — the plaid is showing you that something is connecting that wasn't connected before.

---

## The Palette

The colors should feel like natural dyes on woven cloth — earthy, warm, with depth. Not software colors. Not neon. Colors that could exist in a blanket you'd want to own.

### Base Hues (mapped to conversation character)

| Hue                 | Character                            | Signal                                               |
| ------------------- | ------------------------------------ | ---------------------------------------------------- |
| **Ochre / amber**   | Communal, celebratory, connective    | High positive sentiment + high author diversity      |
| **Warm rust**       | Creative, expressive, cultural       | Art/music/media content clusters                     |
| **Deep indigo**     | Analytical, technical, building      | Code/science/technology clusters                     |
| **Sage green**      | Growth, learning, discovery          | Educational content, questions, shared resources     |
| **Slate blue-grey** | Structural, political, institutional | Policy/governance discussions                        |
| **Sienna**          | Personal, vulnerable, intimate       | Personal stories, support threads                    |
| **Charcoal**        | Conflict, tension, contested         | High sentiment variance, disagreement within cluster |
| **Ivory / cream**   | Meta, reflective, about-the-network  | Discussions about the platform itself                |

The mapping isn't rigid — it's derived from content signals (language patterns, sentiment distribution, topic classification) and blends continuously. A conversation about the politics of technology would be a crossing of slate and indigo, producing a deep teal.

### Luminance

The overall brightness of the textile maps to **network energy** — total volume of conversation relative to baseline. A dim plaid = quiet network. A luminous plaid = high activity. This is the simplest signal and the most ambient — you sense it as the "brightness" of the app.

### Saturation

Saturation maps to **conviction** — how strongly held are the opinions in the network right now? High saturation = people feel strongly. Low saturation / more grey = observational, tentative, uncertain. A desaturated plaid after a confusing event tells you: nobody knows what to think yet.

---

## The Experience

### Resting State (Layer 0)

The plaid is almost invisible — a subtle texture behind the feed, like the weave of fine linen. You might not notice it consciously. It influences the _feeling_ of using the app without demanding attention. The feed content sits on top of it. The texture shifts slowly — over minutes, not seconds.

### Glance (Layer 1)

A very slight downward pull on the feed (not a full pull-to-refresh — maybe 20px) causes the plaid to become slightly more visible. The threads gain a little more contrast. You can start to see the structure — "oh, there are about four main things happening." Release and it fades back. This is the "glance out the window" moment.

### Reveal (Layer 2)

Pull down further (past the refresh threshold, into a dedicated gesture zone) and the plaid expands into a full-screen view. The feed slides down and the textile fills the screen. Now you can see:

- Each thread labeled with a soft, small text tag describing the narrative (not a hashtag — a short phrase like "decentralization debate" or "solstice celebrations")
- The width and color of each thread clearly visible
- The crossings highlighted — tap one to see the bridging conversations
- A subtle animation showing how the plaid has changed over the last few hours — threads widening, narrowing, new ones appearing, old ones fading
- At the top, a single line of text — the "weather report" — a poetic one-sentence summary generated from the data: _"A wide conversation about platform governance is meeting a burst of creative energy around the solstice."_

### Deep Dive (Layer 3)

Tap any thread to enter it. The plaid zooms into that thread's perspective:

- The seed posts that started the narrative
- The key voices (not "influencers" — the people whose posts got the most _replies_, not likes — the ones generating conversation)
- The sentiment arc — how the conversation's emotional texture has evolved over hours
- The related threads — which other conversations are crossing this one
- A reading list — the most substantive posts in this narrative, sorted by depth of engagement (reply depth, not like count)

Tap a crossing point to see the bridge:

- Posts that explicitly connect the two narratives
- Authors who are active in both conversations
- How the crossing evolved — did one narrative absorb the other, or did they create something new?

### Peripheral Signals (Layer 4: Emergence)

The most valuable signal the plaid can give you is: **something new is forming.** A thin thread that didn't exist an hour ago. The plaid handles this through a subtle animation — a new thread appears as a faint, almost invisible line. If it grows, it becomes more visible. If it fades, you never notice it was there.

For the truly significant emergences — a thread that's growing unusually fast with high author diversity (organic, not coordinated) — the plaid can emit a very gentle pulse. Not a notification. Not a badge. A single slow pulse of brightness along the new thread, like a fiber catching the light. You might notice. You might not. But if you're paying attention to the texture, you'll see it.

---

## Your World vs. The World

The plaid has two modes, toggled by a very simple gesture (maybe a two-finger tap, or a long press):

**Global view** — the default. The plaid represents the entire network's state.

**Personal view** — the plaid filters to only show conversations involving people you follow. The same threads may appear but with different widths (your community might be disproportionately focused on one narrative), different crossings (your network might bridge things that the global network doesn't), and some threads might be missing entirely (things happening that your network isn't part of).

The transition between global and personal should be a smooth morph — threads widening, narrowing, appearing, disappearing. The _difference_ between the two views is itself informative: "oh, my network is completely ignoring the biggest global conversation" or "the thing my feed is full of is actually very niche."

A possible third mode: **the gap** — a differential view that highlights only the threads present in global but absent in personal, and vice versa. This is the "what am I missing?" and "what do I know that others don't?" view.

---

## Data Architecture

### What We Need from Pan

**Currently available:**

- `/api/trending/topics` — volume, author counts, velocity ratios → thread width + emergence detection
- `/api/trending/timeline` — temporal evolution → thread animation
- `/api/narratives` — narrative clustering → thread identity and crossing detection
- `/api/sentiment/latest` — sentiment summary → palette saturation and hue
- `/api/sentiment/trends` — sentiment over time → texture grain and arc visualization
- `/api/communities` — community dynamics → crossing brightness

**New signals needed:**

- **Cross-narrative author overlap** — which authors appear in multiple narrative clusters? This drives crossing brightness. Could be a new endpoint: `/api/narratives/crossings`
- **Narrative character classification** — mapping clusters to the palette. Could use language pattern analysis (technical vocabulary → indigo, emotional vocabulary → sienna, etc.). Pan's NLP pipeline could add this.
- **Personal filtering** — given a set of followed DIDs, filter all signals to that social graph. Privacy-sensitive. Options:
  - Client sends DID list, Pan filters server-side (simple but reveals social graph)
  - Client sends a bloom filter of DIDs, Pan does approximate filtering (private but lossy)
  - Pan computes per-community stats, client does the filtering locally based on which communities their follows belong to (best privacy, needs community membership data)
- **Seed post identification** — for each narrative, which post(s) catalyzed it? Pan's firehose sees temporal ordering; the earliest posts in a cluster with high subsequent engagement are the seeds.
- **Sentiment variance within cluster** — not just "positive/negative" but "how much disagreement is there?" High variance = contested = textured thread.

### Rendering Pipeline

```
Pan firehose → narrative clusters + metrics
         ↓
  ShadowSky fetches every 5 min
         ↓
  Transform to textile model:
    - clusters → threads (color, width, opacity, texture)
    - cross-cluster engagement → crossings (brightness, blend)
    - temporal deltas → animation targets
         ↓
  Skia Canvas renders the plaid:
    - Warp threads (enduring narratives, vertical)
    - Weft threads (emergent narratives, horizontal)
    - Crossing blends (GPU color mixing)
    - Smooth animation between states (spring physics)
         ↓
  Composited behind feed content
    - Low opacity at rest
    - Increases on pull gesture
    - Full-screen on deep pull
```

### Technical Approach

**@shopify/react-native-skia** is the rendering engine. It gives us:

- GPU-accelerated 2D drawing on both iOS and Android
- Shader support for the color blending at crossings
- Smooth animation primitives
- Canvas compositing behind React Native views

The plaid itself is drawn as:

1. A set of vertical rectangles (warp threads) with varying width, color, opacity
2. A set of horizontal rectangles (weft threads) with varying width, color, opacity
3. At each crossing, a blend mode that mixes the two thread colors (multiply blend is closest to how actual dye crossings work in textiles)
4. Optional: a subtle noise texture overlaid to give it a cloth-like quality (Perlin noise shader)
5. Optional: very subtle parallax — the plaid shifts slightly as you scroll the feed, creating a sense of depth, like the content is floating above the textile

Animation: When the data updates (every 5 min), the threads animate to their new widths/colors using spring physics (react-native-reanimated shared values driving Skia properties). New threads fade in from zero opacity. Dying threads fade out. The transition should take 10-15 seconds — slow enough that you perceive change, not a jarring update.

---

## Philosophy

This system is explicitly not engagement-optimized. It doesn't tell you what to click. It doesn't create FOMO. It doesn't have numbers that go up.

It's an **understanding tool**. Its purpose is to make you wiser about the information environment you're swimming in. The most successful outcome is a user who _doesn't_ open a thread because the plaid told them everything they needed to know — "there's a big contentious thing happening, it's not relevant to me, I can move on with my day."

The aesthetic should feel like a **craft object** — something made with care, that rewards sustained attention but doesn't punish inattention. A hand-woven blanket doesn't notify you. It's just there, being beautiful, and if you look closely you see the pattern that tells you something about where it came from.

The network weather plaid tells you something about where _you_ are — in the stream of human conversation, right now.

---

## Milestones

### v0.1 — Ambient Gradient

Single ambient color behind the feed, derived from dominant sentiment. Just warmth/coolness. Proves the data pipeline and rendering.

### v0.2 — Two-Tone Weave

Two dominant narratives rendered as crossing bands. Simple plaid. Pull-down reveals labels.

### v0.3 — Full Textile

All active narratives rendered. Color palette active. Crossings blend. Animation on data updates.

### v0.4 — Interaction

Pull-to-reveal gesture. Tap threads for narrative detail. Tap crossings for bridge posts.

### v0.5 — Personal View

Global vs. personal toggle. Gap view. Social graph filtering via Pan.

### v0.6 — Emergence Pulse

New thread detection with subtle animation. The plaid becomes predictive — showing you what's forming, not just what's formed.
