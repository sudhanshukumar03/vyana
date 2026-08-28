export const API_BASE_URL = 'http://localhost:8000/api/v1';

export const fetchVitals = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/vitals`);
    if (!res.ok) throw new Error('Failed to fetch vitals');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
};

export const fetchTrends = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/trends`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
};
