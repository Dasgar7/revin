import React from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToString } from 'react-dom/server';

const md1 = "<think>Hello world</think>";
const md2 = "<think>Hello world";
const md3 = "Some text <think>Hello</think>";

console.log(renderToString(React.createElement(ReactMarkdown, { children: md1 })));
console.log(renderToString(React.createElement(ReactMarkdown, { children: md2 })));
console.log(renderToString(React.createElement(ReactMarkdown, { children: md3 })));
