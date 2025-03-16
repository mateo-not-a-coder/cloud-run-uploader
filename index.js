'use strict';

const express = require('express');
const { Storage } = require('@google-cloud/storage');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

const storage = new Storage();
const BUCKET_NAME = "meet-recordings-bucket-speechmatics";

/**
 * ✅ Authenticate with Google Drive API
 */
async function getDriveAuth() {
  return new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
}

/**
 * ✅ Endpoint to test access to the transcript file in GCS
 * Usage: GET /test-transcript?fileName=Alanis_Marin_2025-03-14.txt
 */
app.get('/test-transcript', async (req, res) => {
  try {
    const { fileName } = req.query;
    if (!fileName) {
      return res.status(400).json({ error: "Missing fileName in query string" });
    }
    const srcFile = `transcripts/${fileName}`;
    const [transcriptBuffer] = await storage.bucket(BUCKET_NAME).file(srcFile).download();
    const transcriptContent = transcriptBuffer.toString();

    console.log(`📜 Successfully fetched transcript for ${fileName}`);
    // Returning plain text so you can see the contents
    return res.type('text/plain').send(transcriptContent);
  } catch (error) {
    console.error("❌ [ERROR] Failed to fetch transcript:", error);
    return res.status(500).json({ error: "Failed to fetch transcript", details: error.message });
  }
});

/**
 * ✅ Cloud Run Endpoint: Move Transcript to Student Drive Folder
 */
app.post('/move-transcript', async (req, res) => {
  try {
    console.log("✅ [LOG] Received request to /move-transcript");
    const { fileName, driveFolderId } = req.body;

    if (!fileName || !driveFolderId) {
      console.error("❌ [ERROR] Missing fileName or driveFolderId");
      return res.status(400).json({ error: "Missing fileName or driveFolderId" });
    }

    console.log(`📂 Moving ${fileName} to folder ${driveFolderId}`);

    // ✅ Fetch transcript content from GCS
    const srcFile = `transcripts/${fileName}`;
    const [transcriptBuffer] = await storage.bucket(BUCKET_NAME).file(srcFile).download();
    const transcriptContent = transcriptBuffer.toString();

    console.log(`📜 Fetched transcript for ${fileName}`);

    // ✅ Authenticate with Google Drive API
    const auth = await getDriveAuth();
    const driveClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: driveClient });

    // ✅ Upload transcript to Drive
    const fileMetadata = { name: fileName, parents: [driveFolderId] };
    const media = { mimeType: 'text/plain', body: transcriptContent };

    const fileResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });

    console.log(`✅ [SUCCESS] Uploaded transcript as file ID: ${fileResponse.data.id}`);
    return res.json({
      status: "success",
      message: `Uploaded ${fileName} to Drive. File ID: ${fileResponse.data.id}`
    });

  } catch (error) {
    console.error("❌ [ERROR] Failed to move transcript:", error);
    return res.status(500).json({ error: "Failed to move transcript", details: error.message });
  }
});

/**
 * ✅ Start Cloud Run Server
 */
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 Cloud Run service listening on port ${PORT}`)
);
