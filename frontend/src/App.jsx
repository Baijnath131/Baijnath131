import { useMemo, useState } from "react";

const API_BASE = "http://localhost:4001";

async function parseResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedFileId, setUploadedFileId] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(8);
  const [overlayText, setOverlayText] = useState("Sample caption");
  const [mergeSelection, setMergeSelection] = useState([]);
  const [resultUrl, setResultUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canMerge = useMemo(() => mergeSelection.length > 1, [mergeSelection]);

  const uploadVideo = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("video", selectedFile);
      const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
      const data = await parseResponse(res);
      setUploadedFileId(data.fileId);
      setUploadedFiles((prev) => [data.fileId, ...prev.filter((f) => f !== data.fileId)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const trimCurrent = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/edit/trim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: uploadedFileId, start: Number(start), duration: Number(duration) })
      });
      const data = await parseResponse(res);
      setResultUrl(`${API_BASE}${data.outputUrl}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addCaption = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/edit/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: uploadedFileId, text: overlayText })
      });
      const data = await parseResponse(res);
      setResultUrl(`${API_BASE}${data.outputUrl}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const mergeVideos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/edit/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: mergeSelection })
      });
      const data = await parseResponse(res);
      setResultUrl(`${API_BASE}${data.outputUrl}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onMergeSelectionChange = (fileId) => {
    setMergeSelection((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  return (
    <main className="container">
      <h1>Video Editing App (Frontend + Backend)</h1>
      <p className="subtitle">Upload clips, trim, add caption text, and merge selected videos.</p>

      <section className="card">
        <h2>1) Upload Video</h2>
        <input type="file" accept="video/*" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
        <button onClick={uploadVideo} disabled={loading || !selectedFile}>
          Upload
        </button>
        {uploadedFileId && <p className="success">Active file: {uploadedFileId}</p>}
      </section>

      <section className="card">
        <h2>2) Trim Video</h2>
        <label>
          Start (seconds)
          <input type="number" min="0" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Duration (seconds)
          <input type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </label>
        <button onClick={trimCurrent} disabled={loading || !uploadedFileId}>
          Trim Active Video
        </button>
      </section>

      <section className="card">
        <h2>3) Add Text Overlay</h2>
        <input value={overlayText} onChange={(e) => setOverlayText(e.target.value)} placeholder="Caption text" />
        <button onClick={addCaption} disabled={loading || !uploadedFileId || !overlayText.trim()}>
          Apply Caption
        </button>
      </section>

      <section className="card">
        <h2>4) Merge Multiple Uploads</h2>
        {uploadedFiles.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          <div className="merge-list">
            {uploadedFiles.map((fileId) => (
              <label key={fileId}>
                <input
                  type="checkbox"
                  checked={mergeSelection.includes(fileId)}
                  onChange={() => onMergeSelectionChange(fileId)}
                />
                {fileId}
              </label>
            ))}
          </div>
        )}
        <button onClick={mergeVideos} disabled={loading || !canMerge}>
          Merge Selected Files
        </button>
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <p>Processing…</p>}

      {resultUrl && (
        <section className="card">
          <h2>Export Preview</h2>
          <video controls src={resultUrl} width="720" />
          <a href={resultUrl} target="_blank" rel="noreferrer">
            Download exported video
          </a>
        </section>
      )}
    </main>
  );
}
