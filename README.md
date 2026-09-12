# Real-Time Collaborative Drawing Canvas

A real-time multiplayer drawing application that allows multiple users to draw and collaborate on the same canvas through shared rooms.

## Live Demo

https://collaborative-canvas-iota-seven.vercel.app

## GitHub Repository

https://github.com/kirubakothandan04-sudo/collaborative-canvas

## Features

- Real-time collaborative drawing
- Room-based collaboration
- Pen tool
- Pencil tool
- Brush tool
- Eraser
- Line tool
- Rectangle tool
- Circle tool
- Arrow tool
- Text tool
- Color selection
- Brush size control
- Undo and Redo
- Clear canvas
- Export canvas as PNG
- Shareable room links
- Collaborator presence
- Zoom controls
- Responsive and polished interface

## Tech Stack

- React
- TypeScript
- Vite
- HTML5 Canvas
- Yjs
- Y-PartyServer
- PartyServer
- Cloudflare Workers
- Cloudflare Durable Objects
- Vercel

## Architecture

```text
React + TypeScript
        |
        v
HTML5 Canvas
        |
        v
Y-PartyServer Provider
        |
        v
Cloudflare Worker
        |
        v
PartyServer
        |
        v
Cloudflare Durable Objects
        |
        v
Yjs Real-Time Synchronization
