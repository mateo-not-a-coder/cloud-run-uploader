const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// Middleware to parse JSON bodies
app.use(express.json());

// A simple POST endpoint to receive file info from Apps Script
app.post('/upload', (req, res) => {
  const fileInfo = req.body;
  console.log('Received file info:', fileInfo);
  // Later: add logic here to download the file from Drive and upload to GCS.
  res.status(200).json({ message: 'File info received successfully', fileInfo });
});

// A basic GET endpoint
app.get('/', (req, res) => {
  res.send('Cloud Run Uploader is running!');
});

app.listen(port, () => {
  console.log(`Cloud Run uploader service listening on port ${port}`);
});
