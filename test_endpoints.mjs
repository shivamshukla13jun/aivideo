import axios from 'axios';

const PORT = process.env.PORT || '7000';
const BASE_URL = `http://localhost:${PORT}`;

async function testLocalEndpoints() {
  console.log('=== Testing Local Suwayomi & Cloudinary Endpoints ===\n');

  try {
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('[PASS] /health:', health.data);
  } catch (err) {
    console.log('[FAIL] /health (is server running?):', err.message);
  }

  try {
    const cloudinaryStatus = await axios.get(`${BASE_URL}/api/v1/cloudinary/status`);
    console.log('[PASS] /api/v1/cloudinary/status:', cloudinaryStatus.data);
  } catch (err) {
    console.log('[FAIL] /api/v1/cloudinary/status:', err.message);
  }

  try {
    const sources = await axios.get(`${BASE_URL}/api/v1/source/list`);
    console.log('[PASS] /api/v1/source/list (local only):', sources.data);
  } catch (err) {
    console.log('[FAIL] /api/v1/source/list:', err.message);
  }

  try {
    const categories = await axios.get(`${BASE_URL}/api/v1/category`);
    console.log(`[PASS] /api/v1/category (${categories.data.length} categories)`);
  } catch (err) {
    console.log('[FAIL] /api/v1/category:', err.message);
  }

  try {
    const mangas = await axios.get(`${BASE_URL}/api/v1/manga?inLibrary=true`);
    console.log(`[PASS] /api/v1/manga (${mangas.data.length} local manga in library)`);
  } catch (err) {
    console.log('[FAIL] /api/v1/manga:', err.message);
  }
}

testLocalEndpoints();
