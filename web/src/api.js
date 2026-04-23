const JSON_HEADERS = {
  "Content-Type": "application/json",
};

async function request(path, options = {}) {
  const response = await fetch(path, options);

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Keep generic message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function fetchDocuments() {
  return request("/api/documents");
}

export function fetchDocument(documentId) {
  return request(`/api/documents/${encodeURIComponent(documentId)}`);
}

export function createDocument(payload) {
  return request("/api/documents", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function updateDocument(documentId, payload) {
  return request(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function deleteDocument(documentId) {
  return request(`/api/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

export function fetchMacros() {
  return request("/api/macros");
}

export function updateMacro(name, actions) {
  return request(`/api/macros/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ actions }),
  });
}

export function deleteMacro(name) {
  return request(`/api/macros/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}
