const express = require("express");
const { Storage } = require("@google-cloud/storage");
const { google } = require("googleapis");

const app = express();
app.use(express.json());

// ✅ Initialize Google Cloud Storage and Drive API
const storage = new Storage();
const drive = google.drive("v3");

// ✅ Define routes for each workflow

// 📌 Route 1: File Upload from Google Drive to GCS (previously in `server.js`)
app.post("/upload", async (req, res) => {
  try {
    const { fileId, fileName } = req.body;
    if (!fileId || !fileName) {
      return res.status(400).json({ error: "Missing fileId or fileName" });
    }

    const bucketName = "meet-recordings-bucket-speechmatics";
    const destFileName = `incoming/${fileName}`;

    // ✅ Download from Google Drive
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const driveAuth = await auth.getClient();
    const driveResponse = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream", auth: driveAuth }
    );

    // ✅ Upload to Google Cloud Storage
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destFileName);
    const stream = file.createWriteStream();

    driveResponse.data.pipe(stream).on("finish", () => {
      res.json({ status: "success", message: "File uploaded to GCS." });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📌 Route 2: Move Transcripts from GCS to Google Drive (previously in `index.js`)
app.post("/move-transcript", async (req, res) => {
  try {
    const { fileName, driveFolderId } = req.body;
    if (!fileName || !driveFolderId) {
      return res.status(400).json({ error: "Missing fileName or driveFolderId" });
    }

    const bucketName = "meet-recordings-bucket-speechmatics";
    const file = storage.bucket(bucketName).file(`transcripts/${fileName}`);

    // ✅ Download transcript from GCS
    const [transcriptContent] = await file.download();

    // ✅ Upload transcript to Google Drive
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const driveAuth = await auth.getClient();
    const driveResponse = await drive.files.create({
      auth: driveAuth,
      requestBody: {
        name: fileName,
        parents: [driveFolderId],
        mimeType: "text/plain",
      },
      media: {
        mimeType: "text/plain",
        body: transcriptContent.toString(),
      },
    });

    res.json({ status: "success", message: "Transcript moved to Google Drive.", fileId: driveResponse.data.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Health Check Route
app.get("/", (req, res) => {
  res.send("Cloud Run Service is running.");
});
console.log("Registered routes:");
app._router.stack.forEach(function (r) {
  if (r.route && r.route.path) {
    console.log(r.route.path);
  }
});
// ✅ Start the Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
