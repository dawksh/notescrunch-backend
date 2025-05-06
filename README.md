# PDF Summarizer API

Simple Express server that processes PDF files using Google's Gemini API.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with:

```
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```

3. Run the server:

```bash
npm run dev
```

## Usage

Send a POST request to `/api/summarize-pdf` with a PDF file in the form data:

```bash
curl -X POST -F "pdf=@your-file.pdf" http://localhost:3000/api/summarize-pdf
```

The response will contain the summarized bullet points from the PDF.
