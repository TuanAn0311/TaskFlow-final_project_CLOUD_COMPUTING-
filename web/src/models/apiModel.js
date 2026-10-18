const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiUrl = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : '');
export const API_URL = apiUrl
  ? (/^https?:\/\//i.test(apiUrl) ? apiUrl : `https://${apiUrl}`).replace(/\/+$/, '')
  : '';

export async function requestJson(path, { token, method = 'GET', body } = {}) {
  if (!API_URL) {
    throw new Error('VITE_API_URL must be configured for the production web build.');
  }

  const headers = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`Cannot connect to the API at ${API_URL}. Check the API URL and network connection.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The API returned an invalid response.');
  }
  return { response, data };
}
