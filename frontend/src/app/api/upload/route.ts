import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Use Node.js runtime for stream handling

export async function POST(req: NextRequest) {
    try {
        const backendUrl = "http://127.0.0.1:8000/upload/";

        // Get the content type header (crucial for multipart boundaries)
        const contentType = req.headers.get("content-type");

        // Check if body is available
        if (!req.body) {
            return NextResponse.json({ detail: "No file uploaded" }, { status: 400 });
        }

        // Stream the request body directly to the backend
        // 'duplex: "half"' is required for streaming bodies in Node.js fetch
        const response = await fetch(backendUrl, {
            method: "POST",
            headers: {
                "Content-Type": contentType || "",
            },
            body: req.body,
            // @ts-ignore
            duplex: "half",
        });

        if (!response.ok) {
            // Try to read error details
            const errorText = await response.text();
            console.error("Backend Error:", response.status, errorText);
            return NextResponse.json(
                { detail: `Backend Error: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        console.log("Successfully proxied upload and received data from backend.");
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Proxy Upload Critical Failure:", error);
        return NextResponse.json(
            { detail: `Upload Proxy Failed: ${error.message}` },
            { status: 500 }
        );
    }
}
