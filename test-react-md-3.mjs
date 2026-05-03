import React from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToString } from 'react-dom/server';

const md1 = `
<think>
I am thinking.
\`\`\`tsx
console.log('test')
\`\`\`
`;

const components = {
    code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        const isInline = !match && !className;
        if (!isInline && match) {
            return React.createElement('div', { className: "custom-badge" }, "Code mapped: " + match[1]);
        }
        return React.createElement('code', { className, ...props }, children);
    },
    pre({ children }) {
        return React.createElement('div', { className: "my-2" }, children);
    }
};

console.log(renderToString(React.createElement(ReactMarkdown, { components, children: md1 })));
