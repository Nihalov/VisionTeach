# VisionTeach Backend

Backend server for VisionTeach application built with Express.js

## Project Structure

```
src/
  ├── index.js          # Entry point
  ├── routes/           # API routes
  ├── controllers/      # Request handlers
  ├── models/           # Data models
  ├── middleware/       # Custom middleware
  ├── config/           # Configuration files
  └── utils/            # Utility functions
tests/                  # Test files
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration

## Development

Start development server with auto-reload:

```bash
npm run dev
```

## Production

Start server:

```bash
npm start
```

## Testing

Run tests:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```
