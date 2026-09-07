export interface NormalizedQuizResult {
  title: string;
  totalQuestions: number;
  questions: Array<{
    id: number;
    question: string;
    options: string[];
    correctAnswer: number;
    explanation: string;
  }>;
}

export async function fetchNotebookLMQuiz(urlOrArtifactId: string): Promise<NormalizedQuizResult> {
  let artifactId = urlOrArtifactId.trim();
  const uuidMatch = artifactId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    const artifactMatch = artifactId.match(/\/artifact\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (artifactMatch) {
      artifactId = artifactMatch[1];
    } else {
      artifactId = uuidMatch[0];
    }
  }

  const rpcPayload = JSON.stringify([
    artifactId,
    [2, null, null, [1, null, null, null, null, null, null, null, null, null, [1]], [[1, 4, 8, 10, 14]]]
  ]);
  const fReq = JSON.stringify([[["v9rmvd", rpcPayload, null, "generic"]]]);
  const params = new URLSearchParams();
  params.append('f.req', fReq);

  const res = await fetch('https://notebook.google.com/_/LabsTailwindUi/data/batchexecute?rpcids=v9rmvd', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    body: params.toString()
  });

  if (!res.ok) {
    throw new Error(`NotebookLM RPC returned HTTP ${res.status}`);
  }

  const txt = await res.text();
  const match = txt.match(/\[\["wrb\.fr","v9rmvd","(.*)",null/s);
  if (!match) {
    throw new Error('NotebookLM response did not contain a valid quiz payload.');
  }

  const inner = JSON.parse('"' + match[1] + '"');
  const parsed = JSON.parse(inner);
  const title = parsed[0]?.[1] || 'NotebookLM Quiz';
  const html = parsed[0]?.[9]?.[0];
  if (!html) {
    throw new Error('No quiz content found in NotebookLM response.');
  }

  const appDataIdx = html.indexOf('data-app-data="');
  if (appDataIdx === -1) {
    throw new Error('No data-app-data found in NotebookLM response.');
  }

  const jsonStart = appDataIdx + 'data-app-data="'.length;
  const chunk = html.slice(jsonStart, jsonStart + 60000);
  const decoded = chunk
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  let depth = 0;
  let endPos = -1;
  for (let i = 0; i < decoded.length; i++) {
    if (decoded[i] === '{') depth++;
    else if (decoded[i] === '}') {
      depth--;
      if (depth === 0) {
        endPos = i + 1;
        break;
      }
    }
  }

  if (endPos === -1) {
    throw new Error('Could not parse balanced JSON from NotebookLM data.');
  }

  const appData = JSON.parse(decoded.slice(0, endPos));
  const rawQuiz = appData.quiz || appData.questions || [];
  if (!Array.isArray(rawQuiz) || rawQuiz.length === 0) {
    throw new Error('No questions array found in NotebookLM data.');
  }

  const questions = rawQuiz.map((item: any, idx: number) => {
    const question = item.question || `Question ${idx + 1}`;
    const rawOptions = item.answerOptions || item.options || [];
    const options = rawOptions.map((o: any) => (typeof o === 'string' ? o : o.text || String(o)));
    const correctIdx = rawOptions.findIndex((o: any) => o.isCorrect === true);
    const explanation = rawOptions[correctIdx]?.rationale || `The correct answer is: ${options[correctIdx] || 'Option 1'}`;

    return {
      id: idx + 1,
      question: String(question),
      options: options.length >= 2 ? options : ['True', 'False'],
      correctAnswer: correctIdx >= 0 ? correctIdx : 0,
      explanation: String(explanation)
    };
  });

  return {
    title,
    totalQuestions: questions.length,
    questions
  };
}
