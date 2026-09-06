# Pipeline Map

A node-graph canvas for pitching a system before it exists. One HTML file, no build, no backend. Drag, rename, rewire, animate the flow, fly between saved camera views, record the screen.

**Live demo:** https://karusrus.github.io/pipeline-map/

![Pipeline Map — pan, fly to a node, drag it, wires follow](docs/preview.gif)

## Why

When you sell an automation, a data pipeline or an AI workflow to someone who hasn't seen it yet, the artefact is usually a screenshot of n8n or a slide with boxes. Neither shows *what flows where*. This canvas borrows the visual language of ComfyUI — typed sockets, coloured wires, groups, widgets inside nodes — and adds the two things a pitch needs: motion along the wires, and a camera you can drive while you talk.

It was built in an evening for a creative-producer test assignment: a draft of how ad creative could be produced at volume for a subscription app, with agents running the gates and one human inbox for exceptions. That draft is the sample you see when you open the tool.

## What it does

- **Pan and zoom** — drag the canvas, wheel or pinch to zoom (12%–300%), `Fit` or `F` to frame everything.
- **Move** — drag a node by its title. Drag a group title and the group carries its nodes and notes.
- **Rename** — double-click any text: node title, badge, socket label, widget key or value, group title, note.
- **Rewire** — drag from an output dot to an input dot. Wire colour follows the output's type.
- **Delete** — select a node, wire, note or group and press `Delete`. `Ctrl+Z` undoes up to 60 steps.
- **Flow** — `Flow` or `A` animates traffic along every wire: dashes and particles move from output to input. Select a wire and press `1`, `2` or `3` to set how much runs through it.
- **Camera slots** — `1`–`5` fly to a saved view with a 0.9 s ease; `Shift+1`–`5` save the current view. Five slots ship pre-set for the sample.
- **Presentation mode** — `H` hides every panel. Nothing but the canvas, for recording.
- **Saves itself** — the layout persists in the browser (`localStorage`). `JSON` opens the layout as text to copy, keep or paste back in. `Reset draft` restores the sample.
- **Notes** — `+ Note` adds a sticky note on the canvas; double-click to edit.

## How to use it for a pitch

1. Open the file, `Reset draft` if you want the sample, or `+ Node` and build your own.
2. Set up three or four camera slots with `Shift+1…`: an opening close-up, the full map, the place where the argument lands.
3. Press `H`, then `A`. Start the screen recording. Walk the slots with the number keys; move one node while you talk so the audience sees the wires follow.

## Wire types

| Colour | Type |
|---|---|
| green | data |
| yellow | brief / copy |
| orange | static creative |
| pink | video |
| lavender | brand asset |
| blue | decision / gate |
| purple, dashed | feedback loop |

Types are just labels on sockets; edit the `T` map at the top of the script to define your own.

## Files

- `index.html` — the whole tool, ~40 KB, self-contained. Open it locally or host it anywhere static.
- `docs/` — preview GIF, MP4 and screenshots used in this README.

## Roadmap, if anyone asks

- Import a workflow JSON from n8n or ComfyUI and lay it out automatically.
- Export the walkthrough as MP4 without a screen recorder.

Neither exists yet. If you would use them, open an issue and say so — that is the only thing that will get them built.

## Licence

MIT. Made by [Ruslan Karymov](https://karusrus.github.io) — design lead, creative automation, data-driven brand systems.
