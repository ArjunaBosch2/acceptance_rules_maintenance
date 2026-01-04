import { useEffect, useState } from "react";

export default function App() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    fetch("/api/records?active=true")
      .then((r) => r.json())
      .then(setRecords)
      .catch(console.error);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Active records</h1>
      <ul>
        {records.map((r) => (
          <li key={r.id}>{r.title}</li>
        ))}
      </ul>
    </div>
  );
}
