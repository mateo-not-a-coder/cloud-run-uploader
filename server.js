const express = require('express');
const { google } = require('googleapis');
const { Storage } = require('@google-cloud/storage');
const stream = require('stream');

const app = express();
const port = process.env.PORT || 8080;

// Configuration: Update these if needed.
const GCS_BUCKET = 'meet-recordings-bucket-speechmatics'; // Your GCS bucket name
const GCS_FOLDER = 'incoming'; // Folder (prefix) in your bucket where files will be stored

app.use(express.json());

// POST /upload endpoint:
// Receives JSON payload with fileId and fileName, downloads the file from Drive, and uploads it to GCS.
app.post('/upload', async (req, res) => {
  try {
    const { fileId, fileName } = req.body;
    if (!fileId || !fileName) {
      return res.status(400).json({ error: 'Missing fileId or fileName' });
    }
    console.log(`Received file info: ${fileName} (ID: ${fileId})`);

    // Initialize the Drive client using Application Default Credentials.
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Attempt to download the file from Google Drive as a stream.
    let driveResponse;
    try {
      driveResponse = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      console.log("Drive file download started successfully.");
    } catch (driveError) {
      console.error("Error downloading file from Drive:", driveError);
      return res.status(500).json({ error: 'Failed to download file from Drive', details: driveError.message });
    }

    // Prepare destination details for GCS.
    const destination = `${GCS_FOLDER}/${fileName}`;
    const storage = new Storage(); // Uses Application Default Credentials
    const bucket = storage.bucket(GCS_BUCKET);
    const gcsFile = bucket.file(destination);

    // Create a PassThrough stream to pipe the file data.
    const passthrough = new stream.PassThrough();
    driveResponse.data.pipe(passthrough);

    // Create a write stream to upload the file to GCS.
    const writeStream = gcsFile.createWriteStream({
      resumable: true,
      contentType: driveResponse.headers['content-type'] || 'application/octet-stream',
    });

    // Pipe the file data and handle events.
    passthrough.pipe(writeStream)
      .on('error', (err) => {
        console.error('Error uploading file to GCS:', err);
        return res.status(500).json({ error: 'Failed to upload file to GCS', details: err.message });
      })
      .on('finish', async () => {
        // With Uniform Bucket-Level Access enabled, public access is granted at the bucket level.
        // Therefore, we do not call gcsFile.makePublic() here.
        const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${destination}`;
        console.log(`File uploaded successfully to ${publicUrl}`);
        res.json({ status: 'success', publicUrl });
      });
  } catch (error) {
    console.error('Error processing /upload:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Cloud Run Uploader is running!');
});

app.listen(port, () => {
  console.log(`Cloud Run uploader service listening on port ${port}`);
});
