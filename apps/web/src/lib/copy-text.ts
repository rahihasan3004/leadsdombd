export async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText)
    throw new Error(
      "Clipboard is unavailable. Use a secure browser connection and try again.",
    );
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    throw new Error("Could not copy. Allow clipboard access and retry.");
  }
}
