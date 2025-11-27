
export const openMarkdownWindow = async (title: string, url: string) => {
    try {
        // Fetch the markdown content from the URL
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch markdown: ${response.statusText}`);
        }
        const markdownContent = await response.text();

        // Open a new window and display the markdown
        const markdownWindow = window.open('', '_blank', 'width=900,height=700');
        if (markdownWindow) {
            markdownWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${title} - Markdown</title>
                    <meta charset="UTF-8">
                    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
                    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
                    <style>
                        body {
                            margin: 0;
                            padding: 40px;
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                            line-height: 1.6;
                            color: #c9d1d9;
                            background: #0d1117;
                        }
                        .container {
                            max-width: 900px;
                            margin: 0 auto;
                            background: #161b22;
                            padding: 40px;
                            border-radius: 8px;
                            border: 1px solid #30363d;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
                        }
                        h1 { border-bottom: 2px solid #21262d; padding-bottom: 0.3em; color: #e6edf3; }
                        h2 { border-bottom: 1px solid #21262d; padding-bottom: 0.3em; margin-top: 24px; color: #e6edf3; }
                        h3, h4, h5, h6 { color: #e6edf3; }
                        code {
                            background: rgba(110,118,129,0.4);
                            padding: 2px 6px;
                            border-radius: 3px;
                            font-family: 'Courier New', monospace;
                            color: #e6edf3;
                        }
                        pre {
                            background: #161b22;
                            padding: 16px;
                            border-radius: 6px;
                            overflow-x: auto;
                            border: 1px solid #30363d;
                        }
                        pre code {
                            background: none;
                            padding: 0;
                            color: #e6edf3;
                        }
                        blockquote {
                            border-left: 4px solid #30363d;
                            padding-left: 16px;
                            color: #8b949e;
                            margin-left: 0;
                        }
                        a { color: #58a6ff; text-decoration: none; }
                        a:hover { text-decoration: underline; }
                        img { max-width: 100%; }
                        table {
                            border-collapse: collapse;
                            width: 100%;
                            margin: 16px 0;
                        }
                        table th, table td {
                            border: 1px solid #30363d;
                            padding: 8px 12px;
                            color: #c9d1d9;
                        }
                        table th {
                            background: #161b22;
                            font-weight: 600;
                            color: #e6edf3;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div id="content"></div>
                    </div>
                    <script>
                        const markdown = ${JSON.stringify(markdownContent)};
                        const cleanHtml = DOMPurify.sanitize(marked.parse(markdown));
                        document.getElementById('content').innerHTML = cleanHtml;
                    </script>
                </body>
                </html>
            `);
            markdownWindow.document.close();
        }
    } catch (err: any) {
        console.error('Failed to display markdown:', err);
        alert('Failed to load markdown content: ' + err.message);
    }
};
