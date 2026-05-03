export async function* vibeCodeStream(
  prompt: string,
  history: { role: 'user' | 'model'; text: string; attachments?: any[] }[],
  isCustomThemeMode: boolean = false,
  attachments?: any[]
) {
  const response = await fetch('/api/vibe-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, history, isCustomThemeMode, attachments }),
  });

  if (!response.ok || !response.body) {
    throw new Error('Failed to generate code');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
                done = true;
                break;
            }
            let parsed;
            try {
                parsed = JSON.parse(data);
            } catch (e) {
                console.warn('Failed to parse streaming chunk', e, data);
            }
            
            if (parsed) {
                if (parsed.text) {
                    yield parsed.text;
                }
                if (parsed.error) {
                    throw new Error(typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error));
                }
            }
        }
      }
    }
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base64Audio,
      mimeType: audioBlob.type || 'audio/webm',
    }),
  });

  if (!response.ok) {
    throw new Error('Transcription failed');
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.text || '';
}

