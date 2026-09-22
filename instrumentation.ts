export async function register() {
  // Only run in the Node.js server runtime (not edge / client bundles)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startOcrConsumer } = await import('@/lib/queue');
    startOcrConsumer().catch((err) =>
      console.warn('[OCR] Consumer failed to start:', err?.message || err)
    );
  }
}
