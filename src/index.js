import express from "express";
import multer from "multer";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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
const processPdfWithGemini = async (pdfBuffer) => {
    try {
        const data = await pdf(pdfBuffer);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-001"
        });

        const prompt = `Summarize the key information from this document into bullet points:\n\n${data.text}`;
        const result = await model.generateContent(prompt);
        const response = result.response;

        return response.text();
    } catch (error) {
        console.error("Error processing PDF:", error);
        throw new Error("Failed to process PDF or generate summary");
    }
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

            const summary = await processPdfWithGemini(req.file.buffer);
            res.json({ summary });
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
