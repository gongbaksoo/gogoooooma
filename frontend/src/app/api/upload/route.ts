import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Use Node.js runtime for stream handling

export async function POST(req: NextRequest) {
    try {
        const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/upload/`;

        console.log('[Upload Route] Request received');
        console.log('[Upload Route] Backend URL:', backendUrl);
        console.log('[Upload Route] Environment:', process.env.NEXT_PUBLIC_API_URL);

        // Get the content type header (crucial for multipart boundaries)
        const contentType = req.headers.get("content-type");
        console.log('[Upload Route] Content-Type:', contentType);

        // Check if body is available
        if (!req.body) {
            console.error('[Upload Route] No body in request');
            return NextResponse.json({ detail: "No file uploaded" }, { status: 400 });
        }

        console.log('[Upload Route] Sending request to backend...');

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
