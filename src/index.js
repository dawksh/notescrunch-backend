import express from "express";
import multer from "multer";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            error: "File upload error",
            details: "Make sure you're sending the PDF file with field name 'pdf'"
        });
    }
    next(err);
});

if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found in environment variables");
    process.exit(1);
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Process PDF and get summary
const processPdfWithGemini = async (pdfBuffer, summaryStyle = "normal") => {
    try {
        const data = await pdf(pdfBuffer);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

        // Set word limit based on summary style
        const wordLimit = summaryStyle === "detailed" ? 600 : summaryStyle === "brief" ? 200 : 400;
        const styleDesc = summaryStyle === "detailed" ? "detailed" : summaryStyle === "brief" ? "brief" : "standard";

        // Prompt with word limit
        const prompt = `Generate a ${styleDesc} summary of the following document using markdown bullet points, proper markdown formatting, and a maximum of ${wordLimit} words.\n\n---\n\n**Document:**\n\n${data.text}`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("Error processing PDF:", error);
        throw new Error("Failed to process PDF or generate summary");
    }
};

// Generate quiz in markdown from summary
const generateQuizMarkdown = async summary => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
    const prompt = `Given the following summary, create 7-10 relevant quiz questions. Use bullet points. Use this format for the quiz:

    **Question 1:**
    - Option A
    - Option B
    - Option C
    - Option D
    Only output the quiz in markdown, do NOT include any code block or triple backticks. The output should be directly renderable in a React component add two line breaks between questions and one line break between options. add a line break after the options and before the question. Each question should have 4 options, with the correct answer in **bold**.\n\nSummary:\n${summary}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
};

// PDF upload endpoint
app.post("/api/summarize-pdf",
    multer({
        storage: multer.memoryStorage(),
        fileFilter: (req, file, cb) => {
            if (file.mimetype === "application/pdf") {
                cb(null, true);
            } else {
                cb(new Error("Only PDF files are allowed"));
            }
        }
    }).single("pdf"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "No PDF file uploaded",
                    hint: "Send the PDF file with field name 'pdf' in form-data"
                });
            }

            const summaryStyle = req.body.summaryStyle || "normal";
            const summary = await processPdfWithGemini(req.file.buffer, summaryStyle);
            const quiz = await generateQuizMarkdown(summary);
            res.json({ summary, quiz });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

// Quiz PDF upload endpoint
app.post(
    "/api/quiz-pdf",
    multer({
        storage: multer.memoryStorage(),
        fileFilter: (req, file, cb) =>
            file.mimetype === "application/pdf"
                ? cb(null, true)
                : cb(new Error("Only PDF files are allowed")),
    }).single("pdf"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error: "No PDF file uploaded",
                    hint: "Send the PDF file with field name 'pdf' in form-data",
                });
            }
            const summaryStyle = req.body.summaryStyle || "normal";
            const summary = await processPdfWithGemini(req.file.buffer, summaryStyle);
            const quizMarkdown = await generateQuizMarkdown(summary);
            res.json({ quiz: quizMarkdown });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Send PDF files to: POST http://localhost:${port}/api/summarize-pdf`);
    console.log(`Use form-data with field name 'pdf'`);
});
